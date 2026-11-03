"""Compatibility command: rebuild both complete skin variants with the current builder."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build-theme.py')), run_name='__main__')
