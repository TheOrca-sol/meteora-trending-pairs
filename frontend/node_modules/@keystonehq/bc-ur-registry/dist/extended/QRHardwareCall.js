"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRHardwareCall = exports.QRHardwareCallName = void 0;
const RegistryType_1 = require("../RegistryType");
const RegistryItem_1 = require("../RegistryItem");
const lib_1 = require("../lib");
const KeyDerivation_1 = require("./KeyDerivation");
var Keys;
(function (Keys) {
    Keys[Keys["name"] = 1] = "name";
    Keys[Keys["params"] = 2] = "params";
})(Keys || (Keys = {}));
var QRHardwareCallName;
(function (QRHardwareCallName) {
    QRHardwareCallName["KeyDerivation"] = "key-derivation";
})(QRHardwareCallName = exports.QRHardwareCallName || (exports.QRHardwareCallName = {}));
class QRHardwareCall extends RegistryItem_1.RegistryItem {
    constructor(name, params) {
        super();
        this.name = name;
        this.params = params;
        this.getRegistryType = () => RegistryType_1.RegistryTypes.QR_HARDWARE_CALL;
        this.getName = () => this.name;
        this.getParams = () => this.params;
        this.toDataItem = () => {
            const map = {};
            map[Keys.name] = this.name;
            const param = this.params.toDataItem();
            param.setTag(this.params.getRegistryType().getTag());
            map[Keys.params] = param;
            return new lib_1.DataItem(map);
        };
    }
}
exports.QRHardwareCall = QRHardwareCall;
QRHardwareCall.fromDataItem = (dataItem) => {
    const map = dataItem.getData();
    const name = map[Keys.name] || QRHardwareCallName.KeyDerivation;
    let params;
    switch (name) {
        case QRHardwareCallName.KeyDerivation:
            params = KeyDerivation_1.KeyDerivation.fromDataItem(map[Keys.params]);
    }
    return new QRHardwareCall(name, params);
};
QRHardwareCall.fromCBOR = (_cborPayload) => {
    const dataItem = lib_1.decodeToDataItem(_cborPayload);
    return QRHardwareCall.fromDataItem(dataItem);
};
//# sourceMappingURL=QRHardwareCall.js.map