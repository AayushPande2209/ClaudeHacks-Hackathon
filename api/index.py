import sys
import os
from pathlib import Path

# Add the src directory to sys.path so it can find all the agents and db modules
src_path = str(Path(__file__).parent.parent / "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from api import app

# This is what Vercel expects
handler = app
