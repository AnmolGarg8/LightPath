import sys
from pathlib import Path

import pytest

# Add project root to sys.path
root_dir = Path(__file__).parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from pipeline.geometry import are_kernels_loaded  # noqa: E402


@pytest.fixture(autouse=True)
def check_kernels(request):
    """Skip tests marked with requires_kernels if no SPICE kernels are currently loaded."""
    if request.node.get_closest_marker("requires_kernels"):
        if not are_kernels_loaded():
            pytest.skip("Requires physical SPICE kernels. Run scripts/fetch_kernels.py once manifests are filled.")
