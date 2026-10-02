"""Cartesian XY Bresenham planner."""


def line_events(x0, y0, x1, y1):
    """Return synchronized (step_mask, tick_hint) events for integer steps."""
    dx = abs(int(x1) - int(x0))
    dy = abs(int(y1) - int(y0))
    sx = 1 if x1 >= x0 else -1
    sy = 1 if y1 >= y0 else -1
    err = dx - dy
    x, y = int(x0), int(y0)
    events = []
    while True:
        if x == int(x1) and y == int(y1):
            break
        e2 = 2 * err
        mask = 0
        if e2 > -dy:
            err -= dy
            x += sx
            mask |= 1
        if e2 < dx:
            err += dx
            y += sy
            mask |= 2
        events.append((mask, 1))
    return events


class CartesianPlanner:
    def __init__(self, sx_per_mm, sy_per_mm):
        self.sx_per_mm = float(sx_per_mm)
        self.sy_per_mm = float(sy_per_mm)
        self.x_steps = 0
        self.y_steps = 0

    def plan(self, x_mm, y_mm):
        target_x = round(float(x_mm) * self.sx_per_mm)
        target_y = round(float(y_mm) * self.sy_per_mm)
        direction = (target_x >= self.x_steps, target_y >= self.y_steps)
        events = line_events(self.x_steps, self.y_steps, target_x, target_y)
        self.x_steps, self.y_steps = target_x, target_y
        return events, direction

    def zero(self, x_mm=0.0, y_mm=0.0):
        self.x_steps = round(float(x_mm) * self.sx_per_mm)
        self.y_steps = round(float(y_mm) * self.sy_per_mm)
