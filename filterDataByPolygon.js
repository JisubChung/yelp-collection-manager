import fs from 'fs-extra';
import _ from 'lodash';
import { program } from 'commander';
import geolib from 'geolib';

program.requiredOption('-c --collection-id <collectionId>', 'collection id').parse(process.argv);
const options = program.opts();

async function start() {
    const areaJson = await fs.readJson('./areas.json');

    const areaCheck = _(areaJson)
        .keyBy('area')
        .mapValues(({ area, polygon }) => ({
            area,
            check: _.partialRight(geolib.isPointInPolygon, polygon),
        }))
        .values()
        .value();

    // eslint-disable-next-line no-undef
    const listings = await fs.readJson(`./detailedListing/detailedListing_${options.collectionId}.json`);
    const withArea = listings.map((listing) => {
        const { area } = areaCheck.find((area) => area.check(listing.coordinates)) || { area: 'badlands' };
        return { ...listing, area };
    });

    const proc = _(withArea)
        .groupBy('area')
        .map((listings, area) => {
            const areaListingsJson = `./areas/${area}.json`;
            return fs
                .readJson(areaListingsJson)
                .catch((e) => {
                    if (e.code === 'ENOENT') {
                        return [];
                    }
                    throw e;
                })
                .then((al) => fs.outputJson(areaListingsJson, _.uniqBy([...al, ...listings], 'id'), { spaces: 4 }))
                .then(() => areaListingsJson);
        })
        .value();
    const res = await Promise.all(proc);

    console.log(res);
    console.log('done!');
}

start();
