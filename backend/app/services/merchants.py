"""Counterparty-name normalisation shared by merchant verification and lookup."""
import re

_NON_WORD = re.compile(r"[^\w]+", re.UNICODE)


def normalize_name(name: str) -> str:
    """Case/punctuation-insensitive key. Exact match only: no fuzzy guessing of identities."""
    return _NON_WORD.sub(" ", name.casefold()).strip()
