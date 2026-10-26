from fastapi import APIRouter, HTTPException

import store

router = APIRouter(prefix="/topics", tags=["topics"])


def _topic_or_404(topic_id: str):
    topic = store.TOPIC_BY_ID.get(topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.get("")
def list_topics():
    return [store.topic_out(t) for t in store.TOPICS]


@router.get("/favorites")
def favorite_choices():
    chosen = set(store.STATE["favorites"])
    return [{**store.topic_out(store.TOPIC_BY_ID[tid]), "selected": tid in chosen}
            for tid in store.FAVORITE_CHOICES]


@router.post("/{topic_id}/unlock")
def unlock_topic(topic_id: str):
    topic = _topic_or_404(topic_id)
    user = store.STATE["user"]
    if not store.is_unlocked(topic):
        if user["flowers"] < topic["cost"]:
            raise HTTPException(
                status_code=402,
                detail=f"Not enough flowers: {topic['name']} costs {topic['cost']} and you have {user['flowers']}.",
            )
        user["flowers"] -= topic["cost"]
        store.STATE["unlocked"].append(topic_id)
    return {"topic": store.topic_out(topic), "flowers": user["flowers"]}


@router.get("/{topic_id}/lessons")
def topic_lessons(topic_id: str):
    topic = _topic_or_404(topic_id)
    unlocked = store.is_unlocked(topic)
    titles = store.TOPIC_LESSONS.get(topic_id, [])
    return {
        "topic": store.topic_out(topic),
        "unlocked": unlocked,
        "lessons": [{"id": f"{topic_id}-{i}", "index": i, "title": title, "locked": not unlocked}
                    for i, title in enumerate(titles, start=1)],
        "word_count": store.TOPIC_WORD_COUNT,
        "scenario_count": store.TOPIC_SCENARIO_COUNT,
    }
