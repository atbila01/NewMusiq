import asyncio
import json
import sys

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
from deps import db  # noqa: E402
from weekly import weekly_lists, song_key  # noqa: E402

STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
          "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
          "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
          "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
          "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
          "Wisconsin", "Wyoming"]


async def main():
    if "--reset" in sys.argv:
        await db.region_weekly.delete_many({})
    sem = asyncio.Semaphore(5)

    async def one(st):
        async with sem:
            for attempt in range(3):
                try:
                    doc = await weekly_lists(f"US:{st}", f"{st}, United States")
                    print(st, len(doc["top_songs"]), flush=True)
                    return
                except Exception as e:
                    print(st, "retry", e, flush=True)
    await asyncio.gather(*(one(st) for st in STATES))
    counts: dict = {}
    async for d in db.region_weekly.find({}, {"_id": 0, "region_key": 1, "top_songs": 1}):
        for s in d["top_songs"]:
            counts[song_key(s)] = counts.get(song_key(s), 0) + 1
    print("songs appearing in >1 state:", sum(1 for c in counts.values() if c > 1), "max repeats:", max(counts.values()))


asyncio.run(main())
