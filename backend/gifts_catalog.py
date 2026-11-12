"""The Gift Menu: what flowers can be spent on.

Two kinds of gifts:
  * impact   100 flowers. A real tree or a real meal. It costs the project about $1 each; the app only records the
             request (dashboard > Gift redemptions) and the project owner fulfils it.
  * style    50-200 flowers. Avatar outfits, profile frames and wallpapers, all free to give. The pictures are drawn by the
             app (frontend/components/GiftArt.js) from the item id; they are original designs inspired by the genres
             young learners like (adventure at sea, basketball, ninja, superheroes, space), not any existing character.
Prices follow how popular / scarce an item should be: 50 = everyday, 100 = favourite, 150 = rare, 200 = legendary.
"""

IMPACT = {
    "impact_tree": {
        "kind": "impact", "unit": "tree", "name": "Plant a tree", "price": 100, "emoji": "🌳",
        "blurb": "Plant a real tree.",
        "effect": "A growing tree takes in about 20 kg of CO₂ every year, about what a car gives off over 80 km. "
                  "It also gives shade and a home to birds and insects.",
        "thanks": "Thank you! One tree is being planted for you. Every year it can take about 20 kg of CO₂ out of the air, "
                  "about what a car gives off over 80 km.",
        "co2_kg_per_year": 20,
    },
    "impact_meal": {
        "kind": "impact", "unit": "meal", "name": "Donate a meal", "price": 100, "emoji": "🍲",
        "blurb": "Give one meal to someone who is hungry.",
        "effect": "Your meal goes to a person facing hunger. For a child, one meal can mean being able to focus in class that day.",
        "thanks": "Thank you! One meal is being given to a person facing hunger. For a child, a meal can be the difference "
                  "between daydreaming about food and following the lesson.",
    },
}

# slot: outfit (worn on the avatar), frame (a ring around it), wallpaper (the picture behind your profile).
STYLE = [
    ("outfit", "outfit_bandana", "Sea Captain's Bandana", 50, "Ready for an adventure on the open sea."),
    ("outfit", "outfit_headband", "Court Headband", 50, "For every player who never gives up."),
    ("outfit", "outfit_ninja", "Shadow Scarf", 80, "Quiet, fast, mysterious."),
    ("outfit", "outfit_mask", "Hero Mask", 100, "A hero needs a secret identity."),
    ("outfit", "outfit_cape", "Hero Cape", 120, "Fly into the next lesson."),
    ("outfit", "outfit_wizard", "Star Wizard Hat", 120, "Every word is a spell."),
    ("outfit", "outfit_visor", "Neon Visor", 150, "From the neon city of tomorrow."),
    ("outfit", "outfit_crown", "Golden Laurel Crown", 200, "Legendary. For the true champions."),
    ("frame", "frame_halftone", "Comic Halftone", 50, "Straight from a comic page."),
    ("frame", "frame_speed", "Speed Lines", 60, "Action! Something is about to happen."),
    ("frame", "frame_sakura", "Sakura Ring", 80, "Cherry blossoms in spring."),
    ("frame", "frame_flame", "Blaze Ring", 100, "A burning streak."),
    ("frame", "frame_bolt", "Storm Bolt", 120, "Charged with lightning."),
    ("frame", "frame_neon", "Neon Panel", 150, "Glows in the dark."),
    ("frame", "frame_gold", "Champion Gold", 180, "A golden frame with gems."),
    ("frame", "frame_galaxy", "Galaxy Orbit", 200, "Legendary. A little planet circles you."),
    ("wallpaper", "wall_sea", "Dawn at Sea", 50, "A ship sails into the sunrise."),
    ("wallpaper", "wall_court", "Sunset Court", 60, "The last shot of the day."),
    ("wallpaper", "wall_pop", "Pop Panels", 80, "BAM! A page full of energy."),
    ("wallpaper", "wall_city", "Hero City Night", 100, "The signal lights up the sky."),
    ("wallpaper", "wall_dojo", "Moonlit Dojo", 120, "Mountains, moon and a quiet gate."),
    ("wallpaper", "wall_burst", "Speed Burst", 150, "Power rising from the centre."),
    ("wallpaper", "wall_aurora", "Aurora Sky", 180, "Ribbons of light over the snow."),
    ("wallpaper", "wall_cosmos", "Cosmic Voyage", 200, "Legendary. Planets, stars and a comet."),
]
RARITY = {50: "Everyday", 60: "Everyday", 80: "Popular", 100: "Favourite", 120: "Rare", 150: "Rare", 180: "Epic", 200: "Legendary"}

ITEMS = dict(IMPACT)
for slot, item_id, name, price, blurb in STYLE:
    ITEMS[item_id] = {"kind": "style", "slot": slot, "name": name, "price": price, "blurb": blurb, "rarity": RARITY[price]}
