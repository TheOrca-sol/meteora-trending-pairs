/// <reference types="node" />
import { RegistryItem } from "../RegistryItem";
import { DataItem } from '../lib';
import { CryptoKeypath } from "../CryptoKeypath";
export declare enum Curve {
    secp256k1 = "secp256k1",
    ed25519 = "ed25519"
}
export declare enum DerivationAlgorithm {
    slip10 = "slip10",
    bip32ed25519 = "bip32ed25519"
}
export declare class KeyDerivation extends RegistryItem {
    private keypaths;
    private curve;
    private algo;
    private origin?;
    getRegistryType: () => import("../RegistryType").RegistryType;
    constructor(keypaths: CryptoKeypath[], curve?: Curve, algo?: DerivationAlgorithm, origin?: string);
    getKeypaths: () => CryptoKeypath[];
    getCurve: () => Curve;
    getAlgo: () => DerivationAlgorithm;
    getOrigin: () => string | undefined;
    toDataItem: () => DataItem;
    static fromDataItem: (dataItem: DataItem) => KeyDerivation;
    static fromCBOR: (_cborPayload: Buffer) => KeyDerivation;
}
