'use strict';

var electron = require('electron');
var axios = require('axios');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

let tray;
let window = null;
const streamUrl = "http://192.168.13.15:8080/?action=stream";
const snapshotUrl = "http://192.168.13.15:8080/?action=snapshot";
const printer = {
    cameraUrl: "http://192.168.13.15:8080",
    moonrakerAPIUrl: "http://192.168.13.15:4408",
    state: "standby",
    heater_bed: {},
    extruder: {},
    virtual_sdcard: {},
    print_stats: {},
    current_file: {},
    gcode_move: {},
};
electron.app.whenReady().then(() => {
    tray = new electron.Tray(electron.nativeImage.createEmpty());
    window = new electron.BrowserWindow({
        width: 320, // Adjust size as needed
        height: 180,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        webPreferences: {
        // Your webPreferences
        },
    });
    updatePrinterStatus();
    setInterval(updatePrinterStatus, 3000);
    window.loadURL(snapshotUrl);
    window.on("blur", () => {
        if (!(window === null || window === void 0 ? void 0 : window.webContents.isDevToolsOpened())) {
            window === null || window === void 0 ? void 0 : window.hide();
        }
    });
    const getTemperaturesString = () => {
        return `E:${Math.round(printer.extruder.temperature)}°C, B:${Math.round(printer.heater_bed.temperature)}°C`;
    };
    function timeUntil(timestamp) {
        const now = new Date();
        const targetTime = new Date(timestamp);
        let diff = targetTime.getTime() - now.getTime();
        if (diff < 0) {
            return "Time has already passed";
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * 1000 * 60 * 60;
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * 1000 * 60;
        const seconds = Math.floor(diff / 1000);
        return `${hours} hours, ${minutes} minutes, ${seconds} seconds remaining`;
    }
    function updateTrayTitle() {
        return __awaiter(this, void 0, void 0, function* () {
            switch (printer.state) {
                case "printing":
                    // tray?.setTitle(
                    //   `Printing [${printer.print_estimates.progress}%] L:${printer.actualLayer}/${printer.virtual_sdcard.layer_count} `
                    // );
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Printing [${printer.print_estimates.progress}%] Left: ${timeUntil(printer.print_estimates.fileLeft)}`);
                    break;
                case "paused":
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Paused ${printer.actualLayer}/${printer.virtual_sdcard.layer_count} ${printer.print_estimates.progress}%`);
                    break;
                case "standby":
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Standby ${getTemperaturesString()}`);
                    break;
                case "complete":
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Complete ${getTemperaturesString()}`);
                    break;
                case "error":
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Error`);
                    break;
                case "cancelled":
                    tray === null || tray === void 0 ? void 0 : tray.setTitle(`Cancelled ${getTemperaturesString()}`);
                    break;
            }
        });
    }
    tray === null || tray === void 0 ? void 0 : tray.on("click", () => {
        toggleWindow();
    });
    function toggleWindow() {
        if (window === null || window === void 0 ? void 0 : window.isVisible()) {
            window.hide();
            pauseStream();
        }
        else {
            showWindow();
            resumeStream();
        }
    }
    function pauseStream() {
        window === null || window === void 0 ? void 0 : window.webContents.executeJavaScript(`document.querySelector("img").src = "${snapshotUrl}";`, true);
    }
    function updatePrinterStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetchPrinterStatus();
            updateTrayTitle();
        });
    }
    function fetchPrinterStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios.get(`${printer.moonrakerAPIUrl}/printer/objects/query?heater_bed&extruder&virtual_sdcard&print_stats&gcode_move`);
            const data = response.data.result.status;
            printer.state = data.print_stats.state;
            printer.heater_bed = data.heater_bed;
            printer.extruder = data.extruder;
            printer.virtual_sdcard = data.virtual_sdcard;
            printer.print_stats = data.print_stats;
            printer.gcode_move = data.gcode_move;
            const fileResponse = yield axios.get(`${printer.moonrakerAPIUrl}/server/files/metadata?filename=${printer.print_stats.filename}`);
            const fileData = fileResponse.data.result;
            printer.current_file = fileData;
            printer.print_estimates = getTimeEstimates();
            printer.actualLayer = getPrintLayer();
        });
    }
    const getPrintLayer = () => {
        const current_file = printer.current_file;
        const duration = printer.print_stats.print_duration;
        const pos = printer.gcode_move.gcode_position;
        if (current_file &&
            duration > 0 &&
            "first_layer_height" in current_file &&
            "layer_height" in current_file &&
            pos &&
            pos.length >= 3) {
            const z = printer.gcode_move.gcode_position[2];
            const l = Math.ceil((z - current_file.first_layer_height) / current_file.layer_height + 1);
            if (l > 0)
                return l;
        }
        return 1;
    };
    const getTimeEstimates = () => {
        const progress = printer.virtual_sdcard.progress
            ? printer.virtual_sdcard.progress
            : 0;
        const timeNow = Math.floor(Date.now() / 1000);
        const duration = printer.print_stats.print_duration
            ? printer.print_stats.print_duration
            : 0;
        let fileEndTime = 0;
        let fileTotalDuration = 0;
        let fileLeft = 0;
        if (progress > 0 && duration > 0) {
            fileTotalDuration = duration / progress;
            fileLeft = fileTotalDuration - duration;
            fileEndTime = timeNow + fileLeft;
        }
        return {
            progress: Math.floor(progress * 100),
            fileEndTime,
            fileTotalDuration,
            fileLeft,
        };
    };
    function resumeStream() {
        window === null || window === void 0 ? void 0 : window.webContents.executeJavaScript(`document.querySelector("img").src = "${streamUrl}";`, true);
    }
    function showWindow() {
        const trayBounds = tray.getBounds();
        const windowBounds = window.getBounds();
        const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
        let y = Math.round(trayBounds.y + trayBounds.height);
        // Adjust for macOS
        if (process.platform === "darwin") {
            y = Math.round(trayBounds.y);
        }
        window.setPosition(x, y, false);
        window.show();
        window.focus();
    }
    // Double click event
    tray === null || tray === void 0 ? void 0 : tray.on("double-click", () => {
        electron.shell.openExternal(printer.moonrakerAPIUrl);
    });
    // Show state next to the icon (optional)
    tray === null || tray === void 0 ? void 0 : tray.setTitle("Conecting...");
    electron.app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            electron.app.quit();
        }
    });
    electron.app.on("activate", () => {
        if (electron.BrowserWindow.getAllWindows().length === 0) ;
    });
});
//# sourceMappingURL=main.js.map
