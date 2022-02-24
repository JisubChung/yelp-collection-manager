import "dotenv/config";

import { program } from "commander";
import yelpFusion from "yelp-fusion";
import fs from "fs-extra";
import Promise from "bluebird";
import parser from "node-html-parser";
import fetch from "node-fetch";
import _ from "lodash";

const yelp = yelpFusion.client(process.env.YELP_KEY);

program
  .requiredOption("-c --collection-id <collectionId>", "collection id")
  .parse(process.argv);
const options = program.opts();

let offset = 0;

async function getInitialListingData() {
  console.log("fetching collection data");
  let next = [];
  const simpleListing = [];
  const simpleListingPath = `./simpleListings/simpleListing_${options.collectionId}.json`;
  do {
    console.log("fetching %i to %i...", offset, 30 + offset);
    const res = await fetch(
      `https://www.yelp.com/collection/user/rendered_items?collection_id=${options.collectionId}&offset=${offset}&sort_by=distance`,
      { method: "GET" }
    )
      .then((r) => r.json())
      .then((r) => r["list_markup"]);

    await Promise.delay(1000);

    const root = parser.parse(res);
    const hrefs = root.querySelectorAll(".biz-name");

    next = hrefs.map((h) => h.attributes.href.slice(5));
    simpleListing.push(...next);

    offset += 30;
  } while (next.length);

  return fs
    .readJson(simpleListingPath)
    .catch((e) => {
      if (e.code === "ENOENT") {
        return [];
      }
      throw e;
    })
    .then((newListings) =>
      fs.outputJson(
        simpleListingPath,
        _.uniq([...newListings, ...simpleListing]),
        { spaces: 4 }
      )
    )
    .then(() => simpleListing);
}

async function start() {
  const simpleListing = await getInitialListingData();

  console.log("fetching detailed listing data");
  const detailedListing = [];
  const detailedListingPath = `./detailedListing/detailedListing_${options.collectionId}.json`;

  for (const alias of simpleListing) {
    console.log("fetching %s...", alias);
    await Promise.delay(1000)
      .then(() => yelp.business(decodeURIComponent(alias)))
      .then((r) => detailedListing.push(r.jsonBody));
  }

  return fs
    .readJson(detailedListingPath)
    .catch((e) => {
      if (e.code === "ENOENT") {
        return [];
      }
      throw e;
    })
    .then((newListings) =>
      fs.outputJson(
        detailedListingPath,
        _.uniq([...newListings, ...detailedListing], "id"),
        { spaces: 4 }
      )
    )
    .then(() => console.log("fetched %i listings", detailedListing.length));
}

start();
