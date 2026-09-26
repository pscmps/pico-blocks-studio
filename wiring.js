/* Schematic connector layout, not a drawing of physical plug pin order. */
const ServoWiring = (() => {
  const names = {scs009: "SCS009", xl330: "XL330", sts3215: "STS3215", sts3235: "STS3235", pwm: "PWMサーボ"};
  const colours = ["#d28b00", "#2479bf", "#9b51bd", "#159579", "#d4537b", "#6478cc", "#b56826", "#388b9e", "#815f9e", "#659035", "#c25b4f", "#417d65", "#a77299", "#687938", "#946c55", "#516da6"];
  function groups(blocks, jogAxes = {}) {
    const result = [];
    for (const b of blocks.filter(b => /^(scs009|xl330|sts3215|sts3235|pwm)_setup$/.test(b.type))) {
      const model = b.type.split("_")[0];
      if (model === "pwm") {
        let group = result.find(g => g.model === "pwm");
        if (!group) result.push(group = {key: "pwm", model, name: names[model], devices: []});
        const channel = Number(b.getFieldValue("CHANNEL"));
        group.devices.push({id: channel, pin: Number(b.getFieldValue("PIN")), colour: colours[(channel - 1) % colours.length]});
      } else {
        const ids = new Set(blocks.filter(item => item.type.startsWith(model + "_") || (model === "scs009" && item.type === "uart_scs_bind"))
          .filter(item => item.getFieldValue("ID") !== null && item.getFieldValue("ID") !== "" && item.getFieldValue("ID") !== undefined)
          .map(item => Number(item.getFieldValue("ID"))));
        for (const axis of Object.values(jogAxes)) {
          if ((axis.target || "scs009") === model && axis.id !== null) ids.add(axis.id);
        }
        result.push({key: b.id, model, name: names[model], pin: Number(b.getFieldValue("PIN")),
          devices: (ids.size ? [...ids].sort((a, b) => a - b) : [null]).map(id => ({id, colour: colours[0]}))});
      }
    }
    const pwm = result.find(g => g.model === "pwm");
    if (pwm) pwm.devices.sort((a, b) => a.id - b.id);
    return result;
  }
  function render(group, drawPin, pinLabel) {
    const pwm = group.model === "pwm";
    const drawing = drawPin(pwm ? group.devices[0].pin : group.pin);
    const start = 370, stride = 110;
    const height = start + group.devices.length * stride + 18;
    const path = (d, colour, attributes = "") => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2.4" ${attributes}/>`;
    const terminal = (x, y, colour) => `<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="${colour}" stroke-width="2"/>`;
    const text = (x, y, value, cls = "terminal-label", anchor = "start") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${value}</text>`;
    const power = "#e5484d", ground = "#64748b";
    let wires = "", connectors = "", highlights = "";
    for (const [index, device] of group.devices.entries()) {
      const y = start + index * stride, colour = device.colour;
      if (pwm) {
        const {dataPoint} = drawPin(device.pin);
        if (!dataPoint) continue;
        const rail = 12 + index * 4;
        wires += path(`M${dataPoint.x} ${dataPoint.y} H${rail} V${y + 35} H110`, colour, `data-signal="${device.id}"`);
        wires += path(`M60 330 V${y + 56} H110`, power) + path(`M80 345 V${y + 77} H110`, ground);
        highlights += `<circle cx="${dataPoint.x}" cy="${dataPoint.y}" r="4" fill="${colour}"><title>PWM ${device.id}: ${pinLabel(device.pin)}</title></circle>`;
        connectors += `<g data-servo="pwm" data-id="${device.id}"><rect x="104" y="${y}" width="146" height="92" rx="9" fill="white" stroke="${colour}" stroke-width="2"/>`;
        connectors += text(114, y + 17, `PWM ${device.id} · ${pinLabel(device.pin)}`, "board-title");
        for (const [offset, label, c] of [[35, "SIGNAL", colour], [56, "V+", power], [77, "GND", ground]]) connectors += terminal(110, y + offset, c) + text(122, y + offset + 3, label);
        connectors += "</g>";
      } else {
        const positions = [140, 180, 220], colours = [colour, power, ground];
        if (index === 0) {
          if (drawing.dataPoint) wires += path(`M${drawing.dataPoint.x} ${drawing.dataPoint.y} H18 V${y - 16} H140 V${y + 34}`, colour);
          wires += path(`M60 330 V${y - 10} H180 V${y + 34}`, power) + path(`M80 345 V${y - 4} H220 V${y + 34}`, ground);
        } else {
          positions.forEach((x, i) => { wires += path(`M${x} ${y - stride + 76} V${y + 34}`, colours[i], `data-chain="${index}"`); });
        }
        connectors += `<g data-servo="${group.model}" data-id="${device.id ?? "unknown"}"><rect x="104" y="${y}" width="146" height="92" rx="9" class="device-box"/>`;
        connectors += text(114, y + 17, `${group.name} · ${device.id === null ? "ID未指定" : "ID " + device.id}`, "board-title");
        positions.forEach((x, i) => {
          connectors += path(`M${x} ${y + 34} V${y + 76}`, colours[i]);
          connectors += terminal(x, y + 34, colours[i]) + terminal(x, y + 76, colours[i]);
          connectors += `<rect x="${x - 15}" y="${y + 47}" width="30" height="13" fill="white"/>` + text(x, y + 56, ["DATA", "V+", "GND"][i], "caption", "middle");
        });
        connectors += text(110, y + 37, "IN", "caption") + text(110, y + 79, "OUT", "caption") + "</g>";
      }
    }
    wires += path(`M${drawing.groundPoint.x} ${drawing.groundPoint.y} H6 V345 H80`, ground);
    const supply = `<rect x="30" y="302" width="208" height="52" rx="9" class="device-box"/>` + text(134, 317, "サーボ用外部電源（定格を確認）", "board-title", "middle") + terminal(60, 330, power) + text(70, 333, "V+") + terminal(80, 345, ground) + text(90, 348, "GND · ボードと共通");
    return {height, content: wires + drawing.board + highlights + supply + connectors + text(130, height - 6, "機能の接続図です。実物の端子順・線色は要確認", "caption", "middle")};
  }
  return {groups, render};
})();
if (typeof module !== "undefined") module.exports = ServoWiring;
