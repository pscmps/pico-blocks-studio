"""Small, allocation-light G-code parser for the PlotterFlow line protocol."""

import re

WORD_RE = re.compile(r"([A-Z])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?)")


def parse_words(line):
    clean = re.sub(r";.*$|\([^)]*\)", "", line).strip().upper()
    if not clean:
        return "", {}
    words = {letter: float(value) for letter, value in WORD_RE.findall(clean)}
    command = ""
    match = re.match(r"([GMT])\s*(\d+)", clean)
    if match:
        command = match.group(1) + str(int(match.group(2)))
    return command, words


class ModalState:
    def __init__(self):
        self.absolute = True
        self.mm = True
        self.x = 0.0
        self.y = 0.0
        self.z = 1.0
        self.feed = 500.0
        self.enabled = False
        self.pen_down = False

    def motion(self, words):
        target = [self.x, self.y, self.z]
        for index, axis in enumerate(("X", "Y", "Z")):
            if axis not in words:
                continue
            value = words[axis] * (25.4 if not self.mm else 1.0)
            target[index] = value if self.absolute else target[index] + value
        if "F" in words:
            self.feed = max(1.0, words["F"] * (25.4 if not self.mm else 1.0))
        self.x, self.y, self.z = target
        return tuple(target)
