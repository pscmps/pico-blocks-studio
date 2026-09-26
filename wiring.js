/* Schematic connector layout, not a drawing of physical plug pin order. */
const ServoWiring = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw: args[0]}, ...args.slice(1));

  const names = {scs009: "SCS009", xl330: "XL330", sts3215: "STS3215", sts3235: "STS3235", get pwm() { return t("PWMサーボ"); }};
  const colours = ["#2479bf", "#42953b", "#518fe5", "#7e9b22", "#465ab7", "#1b9965", "#389ab6", "#637a29", "#335886", "#286b42", "#68a8cf", "#527a56", "#5c69dd", "#438574", "#346ba8", "#80a842"];
  const serialColours = {scs009: "#dc7900", xl330: "#8246bc", sts3215: "#c23582", sts3235: "#00888e"};
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
          devices: (ids.size ? [...ids].sort((a, b) => a - b) : [null]).map(id => ({id, colour: serialColours[model]}))});
      }
    }
    const pwm = result.find(g => g.model === "pwm");
    if (pwm) pwm.devices.sort((a, b) => a.id - b.id);
    return result;
  }
  function render(input, drawPin, pinLabel) {
    const groups = Array.isArray(input) ? input : [input];
    const drawing = drawPin(null);
    const stride = 110, shift = 40, width = 340;
    const path = (d, colour, attributes = "") => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2.4" ${attributes}/>`;
    const terminal = (x, y, colour) => `<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="${colour}" stroke-width="2"/>`;
    const text = (x, y, value, cls = "terminal-label", anchor = "start") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${value}</text>`;
    const power = "#e5484d", ground = "#64748b";
    let wires = "", connectors = "", highlights = "", supplies = "", backgrounds = "", cursor = 302, signalIndex = 0;
    // Board is drawn first. Signals leave via their nearest edge, never through
    // the board body or a supply card. Extra outer margins support 16 PWM pins.
    const signal = (pin, y, endX, colour, key) => {
      const point = drawPin(pin).dataPoint;
      if (!point) return;
      const x = point.x + shift;
      const right = point.x >= 130;
      const rail = right ? width - 8 - signalIndex * 3 : 8 + signalIndex * 3;
      signalIndex++;
      // GEEK pins face downward inside connector groups; clear the board first.
      const escape = drawing.layout === "geek"
        ? `V${270 + signalIndex * 1.2} H${rail}` : `H${rail}`;
      wires += path(`M${x} ${point.y} ${escape} V${y} H${endX}`, colour, `data-signal="${key}" data-pin="${pin}"`);
      highlights += `<circle cx="${x}" cy="${point.y}" r="4" fill="${colour}"><title>${key}: ${pinLabel(pin)}</title></circle>`;
    };
    const groundX = drawing.groundPoint.x + shift;
    const groundEscape = drawing.layout === "geek" ? `V284 H${width - 3}` : drawing.groundPoint.x < 130
      ? `H3 V284 H${width - 3}` : `H${width - 3} V284`;
    wires += path(`M${groundX} ${drawing.groundPoint.y} ${groundEscape}`, ground);
    for (const group of groups) {
      const pwm = group.model === "pwm";
      const pullup = drawing.layout === "atom" && !pwm;
      const extra = pullup ? 64 : 0, start = cursor + 80 + extra;
      const supplyY = cursor + 15 + extra;
      if (pullup) {
        // Optional component, once per bus (not once per servo ID). 3V3 is
        // the board expansion pin, never the Grove 5V or servo V+ supply.
        const p = drawing.logicPowerPoint, y = cursor + 30, colour = group.devices[0].colour;
        wires += path(`M${p.x + shift} ${p.y} H65 V${y} H108`, "#0f766e", `data-pullup-source="${group.model}"`);
        wires += path(`M140 ${y} H310 V${start - 10} H190`, colour, `data-pullup-data="${group.model}"`);
        highlights += `<circle cx="190" cy="${start - 10}" r="3.5" fill="${colour}"/><circle cx="${p.x + shift}" cy="${p.y}" r="4" fill="#0f766e"/>`;
        connectors += `<g data-pullup="${group.model}" data-pin="${group.pin}"><rect x="108" y="${y - 6}" width="32" height="12" fill="white" stroke="#0f766e" stroke-width="2"/>`;
        connectors += text(70, y - 14, "3V3", "terminal-label") + text(111, y - 14, "2.2 kΩ", "terminal-label");
        connectors += text(106, y + 22, t("必要時に追加 · 1/8 W以上"), "caption") + text(198, y - 14, `${group.name} DATA`, "caption") + "</g>";
      }
      backgrounds += `<rect x="102" y="${supplyY}" width="198" height="48" rx="9" class="device-box"/>`;
      supplies += `<g data-supply="${group.model}">`;
      supplies += text(111, supplyY + 15, t`${group.name}用 外部電源`, "board-title") + terminal(125, supplyY + 34, power) + text(135, supplyY + 37, "V+") + terminal(210, supplyY + 34, ground) + text(220, supplyY + 37, "GND") + "</g>";
      // Each kind has a separate V+ feed; only GND is shared with the board.
      wires += path(`M${width - 3} 284 V${supplyY + 34} H210`, ground);
      for (const [index, device] of group.devices.entries()) {
      const y = start + index * stride, colour = device.colour;
      if (pwm) {
        signal(device.pin, y - 10, 148, colour, `pwm-${device.id}`);
        wires += path(`M148 ${y - 10} V${y + 35} H160`, colour);
        wires += path(`M125 ${supplyY + 34} V${y + 56} H160`, power) + path(`M210 ${supplyY + 34} V${supplyY + 55} H140 V${y + 77} H160`, ground);
        backgrounds += `<rect x="154" y="${y}" width="146" height="92" rx="9" fill="white" stroke="${colour}" stroke-width="2"/>`;
        connectors += `<g data-servo="pwm" data-id="${device.id}">`;
        connectors += text(164, y + 17, `PWM ${device.id} · ${pinLabel(device.pin)}`, "board-title");
        for (const [offset, label, c] of [[35, "SIGNAL", colour], [56, "V+", power], [77, "GND", ground]]) connectors += terminal(160, y + offset, c) + text(172, y + offset + 3, label);
        connectors += "</g>";
      } else {
        const positions = [190, 230, 270], colours = [colour, power, ground];
        if (index === 0) {
          signal(group.pin, y - 10, 190, colour, group.model);
          wires += path(`M190 ${y - 10} V${y + 34}`, colour);
          wires += path(`M125 ${supplyY + 34} V${y - 5} H230 V${y + 34}`, power) + path(`M210 ${supplyY + 34} V${y} H270 V${y + 34}`, ground);
        } else {
          positions.forEach((x, i) => { wires += path(`M${x} ${y - stride + 76} V${y + 34}`, colours[i], `data-chain="${group.model}-${index}"`); });
        }
        backgrounds += `<rect x="154" y="${y}" width="146" height="92" rx="9" fill="white" stroke="${colour}" stroke-width="2"/>`;
        connectors += `<g data-servo="${group.model}" data-id="${device.id ?? "unknown"}"><rect x="158" y="${y + 5}" width="138" height="17" rx="3" fill="white"/>`;
        connectors += text(164, y + 17, `${group.name} · ${device.id === null ? t("ID未指定") : "ID " + device.id}`, "board-title");
        positions.forEach((x, i) => {
          connectors += path(`M${x} ${y + 34} V${y + 76}`, colours[i]);
          connectors += terminal(x, y + 34, colours[i]) + terminal(x, y + 76, colours[i]);
          connectors += `<rect x="${x - 15}" y="${y + 47}" width="30" height="13" fill="white"/>` + text(x, y + 56, ["DATA", "V+", "GND"][i], "caption", "middle");
        });
        connectors += text(160, y + 37, "IN", "caption") + text(160, y + 79, "OUT", "caption") + "</g>";
      }
      }
      cursor = start + group.devices.length * stride + 8;
    }
    const height = cursor + 18;
    return {width, height, content: `<g transform="translate(${shift} 0)">${drawing.board}</g>` + backgrounds + wires + supplies + connectors + highlights + text(width / 2, height - 6, t("機能の接続図です。実物の端子順・定格電圧は要確認"), "caption", "middle")};
  }
  return {groups, render};
})();
if (typeof module !== "undefined") module.exports = ServoWiring;
