"""Gift Menu: the earning table, what flowers can buy, redeeming, wearing, and inviting friends.

    GET  /gifts            balance, today's earnings against the cap, the earning rules with progress, the shop, impact so far
    POST /gifts/redeem     spend flowers on an item {item_id}
    POST /gifts/equip      wear or take off a style item {slot, item_id | null}
    POST /gifts/referral   "a friend invited me": {code}. The friend gets 100 flowers when this learner finishes lesson 1
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import analytics
import hashlib
import charity
import os
import db
import gifts_catalog as catalog
import rewards
import store
from urls import public_url

router = APIRouter(prefix="/gifts", tags=["gifts"])
SLOTS = ("outfit", "frame", "wallpaper")


def _gifts(state):
    g = state.setdefault("gifts", {})
    g.setdefault("owned", [])
    g.setdefault("equipped", {})
    g.setdefault("redeemed", [])  # impact gifts: [{id, at, item_id, unit, name, price}]
    return g


def _impact_totals(g):
    return {"trees": sum(1 for r in g["redeemed"] if r["unit"] == "tree"), "meals": sum(1 for r in g["redeemed"] if r["unit"] == "meal")}


@router.get("")
def get_gifts():
    state = store.STATE
    g = _gifts(state)
    my_code = rewards.code_of(store.current().uid)
    paid = rewards.claim_friends(state, my_code)  # friends who finished lesson 1 since last time
    user = state["user"]
    shop = []
    quota = charity.status()
    for item_id, it in catalog.ITEMS.items():
        row = {"id": item_id, **it, "owned": item_id in g["owned"]}
        if it["kind"] == "impact":
            q = quota[it["unit"]]
            row.update(partner=q["partner"], partner_url=q["url"], available=q["available"], community_total=q["used"])
        row["equipped"] = it["kind"] == "style" and g["equipped"].get(it["slot"]) == item_id
        shop.append(row)
    totals = _impact_totals(g)
    return {
        "flowers": user["flowers"], "earned_today": rewards.earned_today(state),
        "friend_bonus_paid_now": paid,
        "rules": rewards.rules_out(state), "shop": shop, "equipped": g["equipped"],
        "given": [{"id": r["id"], "unit": r["unit"], "name": r["name"], "at": r["at"]} for r in reversed(g["redeemed"])][:10],
        "impact": {**totals, "co2_kg_per_year": totals["trees"] * catalog.IMPACT["impact_tree"]["co2_kg_per_year"]},
        "invite": {"code": my_code, "referred_by": bool(state.get("referral")), **rewards.friends_summary(state, my_code)},
        "name": user.get("name"), "photo_url": f"/photos/{user['photo_token']}" if user.get("photo_token") else None,
    }


class RedeemIn(BaseModel):
    item_id: str


@router.post("/redeem")
def redeem(body: RedeemIn):
    state = store.STATE
    g = _gifts(state)
    item = catalog.ITEMS.get(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="That gift doesn't exist.")
    user = state["user"]
    if item["kind"] == "impact" and not charity.status()[item["unit"]]["available"]:
        raise HTTPException(status_code=409, detail=f"All the {item['unit']}s we have set aside are taken for now. "
                                                    "More are coming soon, and your flowers are safe.")
    if item["kind"] == "style" and body.item_id in g["owned"]:
        raise HTTPException(status_code=409, detail="You already own this.")
    if user["flowers"] < item["price"]:
        raise HTTPException(status_code=402, detail=f"You need {item['price']} flowers and have {user['flowers']}.")
    user["flowers"] -= item["price"]
    row = {"id": f"g{len(g['redeemed']) + 1}", "at": analytics.now_iso(), "item_id": body.item_id, "name": item["name"],
           "price": item["price"], "unit": item.get("unit", item.get("slot")), "lang": store.current_lang()}
    if item["kind"] == "style":
        g["owned"].append(body.item_id)
        g["equipped"][item["slot"]] = body.item_id  # wear it straight away
        message = f"{item['name']} is yours, and you are wearing it."
    else:
        g["redeemed"].append(row)
        message = item["thanks"]
    log = state.setdefault("spend_log", [])
    log.append(row)
    del log[:-300]
    return {"message": message, "gift_id": row["id"], "unit": item.get("unit"), "flowers": user["flowers"], "equipped": g["equipped"],
            "impact": {**_impact_totals(g), "co2_kg_per_year": _impact_totals(g)["trees"] * catalog.IMPACT["impact_tree"]["co2_kg_per_year"]}}


class EquipIn(BaseModel):
    slot: str
    item_id: str | None = None


@router.post("/equip")
def equip(body: EquipIn):
    g = _gifts(store.STATE)
    if body.slot not in SLOTS:
        raise HTTPException(status_code=422, detail="Unknown slot.")
    if body.item_id is None:
        g["equipped"].pop(body.slot, None)
    else:
        item = catalog.ITEMS.get(body.item_id)
        if not item or item["kind"] != "style" or item["slot"] != body.slot or body.item_id not in g["owned"]:
            raise HTTPException(status_code=403, detail="You don't own this yet.")
        g["equipped"][body.slot] = body.item_id
    return {"equipped": g["equipped"]}


class ReferralIn(BaseModel):
    code: str


@router.post("/referral")
def referral(body: ReferralIn):
    """A new learner enters the code of the friend who invited them (at any time)."""
    state = store.STATE
    mine = rewards.code_of(store.current().uid)
    code = body.code.strip().lower()
    if state.get("referral"):
        raise HTTPException(status_code=409, detail="You already entered a friend's code.")
    if code == mine:
        raise HTTPException(status_code=422, detail="That is your own code. Share it with a friend instead.")
    if not any(rewards.code_of(uid) == code for uid, *_ in db.all_states()):
        raise HTTPException(status_code=404, detail="We couldn't find that code. Check it and try again.")
    already = rewards.has_done_lesson(state)  # entered after the first lesson: the friend is paid right away
    state["referral"] = {"by": code, "at": analytics.now_iso(), "done": already}
    if already:
        try:
            rewards.pay_inviter(store.current().uid, state)
        except Exception as e:  # noqa: BLE001
            print(f"WARNING: friend bonus not paid yet: {e}", flush=True)
    return {"ok": True, "already_finished": already}


# ---- Sharing a tree or a meal (the poster + link the app hands to Facebook, Instagram, LinkedIn and X)
DEFAULT_PARTNER = {"tree": "Ecologi", "meal": "ShareTheMeal"}


# Six wordings per kind. Each says what really happened: the learner's flowers helped fund a tree / meal through the partner.
# {lang} is the language they practise, {partner} the charity partner.
_TREE_COPY = [
    ("I helped plant a tree by practising {lang}.", "My Langogo flowers went to {partner} to plant a real tree."),
    ("My {lang} practice helped a new tree take root.", "Flowers earned on Langogo, trees planted through {partner}."),
    ("I contributed to planting a tree, one {lang} lesson at a time.", "A tree can absorb around 20 kg of CO₂ every year."),
    ("Speaking {lang} helped me give back to the planet.", "My Langogo flowers helped plant a tree through {partner}."),
    ("Every {lang} sentence I practised helped plant a tree.", "Planted through {partner}, funded by my Langogo flowers."),
    ("I contributed to a tree planted through {partner}.", "Practising {lang} on Langogo, one flower at a time."),
]
_MEAL_COPY = [
    ("My {lang} practice helped provide a meal.", "Flowers earned on Langogo, given through {partner}."),
    ("I helped put a meal on someone's table.", "I practised {lang} on Langogo; my flowers went to {partner}."),
    ("I contributed to a meal for someone facing hunger.", "Practising {lang} on Langogo, giving through {partner}."),
    ("Speaking {lang} helped share a meal with someone in need.", "My Langogo flowers were given through {partner}."),
    ("Every {lang} lesson helped me share a meal.", "Funded by my Langogo flowers, given through {partner}."),
    ("I helped feed someone by practising {lang}.", "A meal given through {partner} with my Langogo flowers."),
]
SCENES = 6


def share_variant(state, share_key, gift_id, unit):
    """Which of the six pictures / wordings this gift gets. Consecutive gifts of one kind always differ."""
    rows = [r for r in ((state.get("gifts") or {}).get("redeemed") or []) if r.get("unit") == unit]
    idx = next((i for i, r in enumerate(rows) if r.get("id") == gift_id), 0)
    offset = int(hashlib.sha256((share_key or "").encode()).hexdigest()[:8], 16)
    return (offset + idx) % SCENES


def share_texts(unit, partner="", language="", variant=0):
    """(headline, description) for a shared tree / meal. Used by the app and by the public preview page (routers/share.py)."""
    partner = partner or DEFAULT_PARTNER.get(unit, "")
    lang = language or "a new language"
    copy = (_TREE_COPY if unit == "tree" else _MEAL_COPY)[variant % SCENES]
    return copy[0].format(lang=lang, partner=partner), copy[1].format(lang=lang, partner=partner)


def _language_name(state):
    import languages
    return languages.get((state.get("user") or {}).get("language"))["name"]


@router.get("/share/{gift_id}")
def share_gift(gift_id: str, request: Request):
    g = _gifts(store.STATE)
    row = next((r for r in g["redeemed"] if r["id"] == gift_id), None)
    if row is None or row["unit"] not in ("tree", "meal"):
        raise HTTPException(status_code=404, detail="Gift not found.")
    state = store.STATE
    key = rewards.code_of(store.current().uid)
    variant = share_variant(state, key, gift_id, row["unit"])
    title, description = share_texts(row["unit"], charity.status()[row["unit"]]["partner"], _language_name(state), variant)
    token = f"{key}.{gift_id}"
    base = public_url(request)
    return {"title": title, "headline": title, "sub": description, "text": f"{title} {description}", "url": f"{base}/share/gift/{token}",
            "image": f"{base}/static/scenes/{row['unit']}-{variant}.png", "hashtags": ["Langogo", "GiveBack"], "unit": row["unit"], "variant": variant}
