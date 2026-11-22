import { ServerResponse } from "node:http";
import { mergeVaryHeader } from "@/lib/contentNegotiation";
import { isNegotiatedPath } from "@/lib/negotiatedPaths";

/**
 * Next calls res.setHeader("Vary", rscList) after middleware and next.config,
 * which drops Accept on the HTML response. This only rewrites that header when
 * the request URL is one of the five negotiated pages. API routes and other
 * pages are left untouched.
 */
const prototype = ServerResponse.prototype as typeof ServerResponse.prototype & {
  __sonifyVaryMerged?: boolean;
};

if (!prototype.__sonifyVaryMerged) {
  prototype.__sonifyVaryMerged = true;
  const original = prototype.setHeader;
  prototype.setHeader = function setHeader(name, value) {
    if (typeof name === "string" && name.toLowerCase() === "vary" && isNegotiatedPath(this.req?.url)) {
      return original.call(this, name, mergeVaryHeader(mergeVaryHeader(this.getHeader(name), value), "Accept"));
    }
    return original.call(this, name, value);
  };
}
