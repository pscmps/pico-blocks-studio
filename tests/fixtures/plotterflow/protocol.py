"""Line-oriented PlotterFlow protocol and controller."""

from gcode import parse_words, ModalState


class Controller:
    def __init__(self, planner, stepper, pen):
        self.modal = ModalState()
        self.planner = planner
        self.stepper = stepper
        self.pen = pen
        self.stop_requested = False

    def execute(self, line):
        if line and line[0] == "\x85":
            self.stop_requested = True
            self.stepper.stop()
            return "ok"
        command, words = parse_words(line)
        if not command:
            return "ok"
        if command == "G0" or command == "G1":
            if not self.modal.enabled:
                return "error:motors_disabled"
            target = self.modal.motion(words)
            events, direction = self.planner.plan(target[0], target[1])
            self.stepper.set_directions(*direction)
            self.stepper.queue(events)
            if "Z" in words:
                (self.pen.down if target[2] <= 0 else self.pen.up)()
            return "ok"
        if command == "G90":
            self.modal.absolute = True
        elif command == "G91":
            self.modal.absolute = False
        elif command == "G20":
            self.modal.mm = False
        elif command == "G21":
            self.modal.mm = True
        elif command == "G92":
            self.modal.x = words.get("X", self.modal.x)
            self.modal.y = words.get("Y", self.modal.y)
            self.modal.z = words.get("Z", self.modal.z)
            self.planner.zero(self.modal.x, self.modal.y)
        elif command == "M17":
            self.stepper.set_enabled(True)
            self.modal.enabled = True
        elif command == "M18":
            self.stepper.stop()
            self.stepper.set_enabled(False)
            self.modal.enabled = False
        elif command == "M3":
            self.pen.down()
            self.modal.pen_down = True
        elif command == "M5":
            self.pen.up()
            self.modal.pen_down = False
        elif command == "M115":
            return "PlotterFlow MicroPython RP;caps=G0,G1,G90,G91,G20,G21,G92,M17,M18,M3,M5,STOP"
        else:
            return "error:unsupported"
        return "ok"
