// build.js
import fs from "fs";
import { inlineSource } from "inline-source";
import { minify } from "html-minifier-terser";

const LICENSE = fs.readFileSync("LICENSE.txt", "utf8");

const dist_dir = "dist";
if (!fs.existsSync(distDir)){
    fs.mkdirSync(dist_dir, { recursive: true });
}

async function build() {
    // Inline external CSS & JS into HTML
    const inlined = await inlineSource("src/index.html", {
        compress: false,
        rootpath: "src",
    });

    // Minify the resulting HTML
    const minified = await minify(inlined, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        minifyJS: true,
        minifyCSS: true,
    });

    // Write final file with license header
    fs.writeFileSync("dist/tickit.html", `<!--!\n${LICENSE}\n-->\n${minified}`);
    console.log("✅ Built dist/tickit.html");
}

build();

