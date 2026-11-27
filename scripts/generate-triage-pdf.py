"""Compatibility entry point: rebuild the combined drug and triage placeholder guideline."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('generate-sample-pdf.py')),run_name='__main__')
