import { register } from "node:module";

register(new URL("./ts-test-loader.mjs", import.meta.url));
