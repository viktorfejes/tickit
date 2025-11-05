// build.js
import fs from "fs";
import { inlineSource } from "inline-source";
import { minify } from "html-minifier-terser";
import { execSync } from "child_process";

const LICENSE = fs.readFileSync("LICENSE.txt", "utf8");

const dist_dir = "dist";
if (!fs.existsSync(dist_dir)) {
    fs.mkdirSync(dist_dir, { recursive: true });
}

function get_commit_hash() {
    try {
        return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
        return "unknown";
    }
}

async function build() {
    const commit = get_commit_hash();

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

    const final_html = minified.replace(/__COMMIT_HASH__/g, commit);

    // Write final file with license header
    fs.writeFileSync("dist/tickit.html", `<!--!\n${LICENSE}\n-->\n${final_html}`);
    console.log(`✅ Built dist/tickit.html (build ${commit})`);
}

build();

