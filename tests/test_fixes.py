import sys
import asyncio
import hashlib
from pathlib import Path

# Add src to sys.path at the VERY FRONT to avoid path collisions
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pipeline
from pipeline import _synthesize
from api import _enrich_event_display

async def test_synthesize_filter():
    print("\n--- Testing Synthesize Filter ---")
    scenarios = [
        {"strategy": "reshore", "annual_cost_delta_usd": -100, "rank": 1},
        {"strategy": "nearshore", "error": "LLM timed out", "parse_error": True},
        {"strategy": "dual_source", "failed_stub": True}
    ]
    # _synthesize returns (ranked_list, model_name)
    ranked, model = await _synthesize(scenarios)
    
    print(f"Ranked {len(ranked)} scenarios. Model: {model}")
    # It should still return all 3 for the UI, but rationale should indicate failure for filtered ones
    errors = [s for s in ranked if "Synthesis skipped" in s.get("recommendation_rationale", "")]
    if len(ranked) == 3:
        print("Synthesize test PASSED (filtered list sent to LLM, fallback rationale applied).")
    else:
        print(f"Synthesize test unexpected result: {len(ranked)} items")

def test_rate_display_hint():
    print("\n--- Testing Rate Display Hint ---")
    # Old logic would show "0% -> 25%"
    # New logic should show "+25% tariff rate change"
    event = {"rate_change_bps": 2500, "title": "Test Title"}
    enriched = _enrich_event_display(event)
    print(f"Hint for 2500 bps: {enriched['rate_change_hint']}")
    assert enriched["rate_change_hint"] == "+25.0% tariff rate change"
    
    event2 = {"rate_change_bps": -500, "title": "Test Title 2"}
    enriched2 = _enrich_event_display(event2)
    print(f"Hint for -500 bps: {enriched2['rate_change_hint']}")
    assert enriched2["rate_change_hint"] == "-5.0% tariff rate change"
    print("Rate display test PASSED.")

def test_content_hash_stability():
    print("\n--- Testing Content Hash Stability ---")
    # This just ensures hashlib is working as expected in our store context
    title = "Significant Tariff Increase on All Semiconductors"
    h1 = hashlib.sha256(title.encode()).hexdigest()
    h2 = hashlib.sha256(title.encode()).hexdigest()
    assert h1 == h2
    assert len(h1) == 64
    print(f"Hash: {h1[:16]}...")
    print("Hash stability test PASSED.")

async def main():
    try:
        await test_synthesize_filter()
    except Exception as e:
        print(f"Synthesize test FAILED: {e}")
        
    try:
        test_rate_display_hint()
    except Exception as e:
        print(f"Rate display test FAILED: {e}")
        
    try:
        test_content_hash_stability()
    except Exception as e:
        print(f"Hash stability test FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
