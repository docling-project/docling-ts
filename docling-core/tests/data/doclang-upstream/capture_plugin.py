"""Pytest plugin that regenerates ``cases.json`` from the upstream docling-core tests.

It records every ``DocLangDocDeserializer.deserialize_str`` call (input XML, the
supported keyword arguments, and the resulting ``export_to_dict()``, error or
``UserWarning`` messages) of the upstream DocLang tests.

Usage, from the root of ``docling-core`` at the version being ported::

    CAPTURE_OUT=cases.json python -m pytest -p capture_plugin \
        tests/test_deserializer_doclang.py tests/test_deserializer_doclang_source_mapping.py \
        tests/test_doclang_*.py tests/test_inline_whitespace_contract.py \
        tests/test_serialization_doclang.py

with this directory on ``PYTHONPATH``. Calls with ``media_root`` (archive loading
from disk) are not recorded: the TypeScript reader gets its images from a callback.
"""

import json
import os
import warnings

import pytest

from docling_core.transforms.deserializer.doclang import DocLangDocDeserializer

RECORDS: dict = {}
SKIPPED: list = []
CURRENT = {"id": None}
KWARGS = ["page_no", "max_xml_bytes", "max_xml_depth", "max_xml_elements", "repair_unescaped_text"]
_orig = DocLangDocDeserializer.deserialize_str


def _wrapper(self, text, **kwargs):
    if CURRENT["id"] is None or "media_root" in kwargs:
        if "media_root" in kwargs:
            SKIPPED.append(CURRENT["id"])
        return _orig(self, text, **kwargs)
    kw = {k: kwargs[k] for k in KWARGS if k in kwargs}
    key = json.dumps([text, kw], sort_keys=True)
    entry = RECORDS.setdefault(key, {"xml": text, **({"kwargs": kw} if kw else {}), "tests": [], "_n": len(RECORDS)})
    if CURRENT["id"] not in entry["tests"]:
        entry["tests"].append(CURRENT["id"])
    if "doc" in entry or "error" in entry:
        return _orig(self, text, **kwargs)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            doc = _orig(self, text, **kwargs)
        except Exception as e:
            entry["error"] = f"{type(e).__name__}: {e}"
            for w in caught:
                warnings.warn_explicit(w.message, w.category, w.filename, w.lineno)
            raise
    messages = [str(w.message) for w in caught if issubclass(w.category, UserWarning)]
    if messages:
        entry["warnings"] = messages
    entry["doc"] = doc.export_to_dict()
    for w in caught:  # let the tests see the warnings too (``pytest.warns``)
        warnings.warn_explicit(w.message, w.category, w.filename, w.lineno)
    return doc


DocLangDocDeserializer.deserialize_str = _wrapper


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item):
    CURRENT["id"] = item.nodeid
    yield
    CURRENT["id"] = None


def pytest_sessionfinish(session, exitstatus):
    cases = sorted(RECORDS.values(), key=lambda e: e["_n"])
    for case in cases:
        del case["_n"]
    with open(os.environ["CAPTURE_OUT"], "w") as f:
        json.dump(cases, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\ncaptured {len(cases)} cases; media_root tests not recorded: {sorted(set(SKIPPED))}")
