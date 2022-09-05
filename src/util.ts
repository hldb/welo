import path from "path";
import { CID } from "multiformats/cid";
import { base32 } from "multiformats/bases/base32";

export const cidstring = (cid: CID | string) => cid.toString(base32);
export const parsedcid = (string: string) => CID.parse(string, base32);

export interface DirsReturn {
  [name: string]: string;
}

export const dirs = (root: string): DirsReturn =>
  Object.fromEntries(
    ["databases", "identities", "keychain"].map((k) => [k, path.join(root, k)])
  );
