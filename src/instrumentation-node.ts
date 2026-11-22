import { ServerResponse } from "node:http";
import { mergeVaryHeader } from "@/lib/contentNegotiation";

/**
 * Next's app renderer replaces Vary with the RSC token list after middleware.
 * Combine the two instead, so HTML stays cached per Accept without dropping RSC.
 */
const prototype = ServerResponse.prototype as typeof ServerResponse.prototype & { __sonifyVaryMerged?: boolean };

if (!prototype.__sonifyVaryMerged) {
  prototype.__sonifyVaryMerged = true;
  const original = prototype.setHeader;
  prototype.setHeader = function setHeader(name, value) {
    if (typeof name === "string" && name.toLowerCase() === "vary") {
      return original.call(this, name, mergeVaryHeader(mergeVaryHeader(this.getHeader(name), value), "Accept"));
    }
    return original.call(this, name, value);
  };
}
