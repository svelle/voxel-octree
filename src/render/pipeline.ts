import {RTLightNode} from "./node/rt-light/rt-light";
import {Camera} from "./camera";
import {OctreeGrid} from "../octree/grid";
import {EditNode} from "./node/edit/edit-node";
import {RTChunkNode} from "./node/rt-chunk-node/rt-chunk-node";
import {ChunkNode} from "./node/chunk-node/chunk-node";
import {RTGINode} from "./node/denoiser/denoiser";
import {OutputNode} from "./node/output/output";

const tumult = require('tumult')

export class Pipeline {

    chunkNode: ChunkNode;
    rtLightNode: RTLightNode;
    rtGINode: RTGINode;
    edit: EditNode;
    output: OutputNode;

    camera: Camera;

    placeVoxel: boolean = false;

    constructor(public grid: OctreeGrid) {
        this.camera = new Camera();

        this.chunkNode = new ChunkNode(this.camera, grid);
        this.chunkNode.init();

        this.edit = new EditNode(undefined, this.camera, grid);
        this.edit.init();

        this.rtLightNode = new RTLightNode(
            this.chunkNode.frameBuffer.textures[0],
            this.chunkNode.frameBuffer.textures[1],
            this.chunkNode.frameBuffer.textures[2],
            this.camera,
            this.chunkNode.chunks,
            this.chunkNode.colors,
            this.chunkNode
        );
        this.rtLightNode.init();

        this.rtGINode = new RTGINode(this.chunkNode, this.rtLightNode, this.camera);
        this.rtGINode.init();

        this.output = new OutputNode(this.rtGINode);
        this.output.init();

        document.addEventListener("keydown", async (element) => {
            switch (element.key) {
                case "e":
                case "E":
                    this.placeVoxel = true;
                    break;
            }

        });

        document.addEventListener("keyup", async (element) => {
            switch (element.key) {
                case "e":
                case "E":
                    this.placeVoxel = false;
                    break;
            }
        });


        const perlin = new tumult.Perlin2('foobar');

        const max_chunks = 1024;
        const block_width = 4;
        const block_height = 4;

        grid.modify([0, 0, 0], [max_chunks - 1, max_chunks - 1, block_height - 1], 4)

        let texture = 1

        for (let i = 0; i < max_chunks; i += block_width) {
            for (let j = 0; j < max_chunks; j += block_width) {

                for (let k = block_height; k < max_chunks; k += block_height) {
                    let divider = max_chunks / 4;
                    let cutoff = perlin.gen(i / divider, j / divider) * perlin.gen((i / divider) / 4, (j / divider) / 4);
                    cutoff = Math.round(cutoff * max_chunks)
                    if (k >= cutoff) {
                        break
                    }
                    if (k < Math.round(max_chunks * .10)) {
                        texture = 3
                    } else if (k < Math.round(max_chunks * .20)) {
                        texture = 8
                    }
                    grid.modify([i, j, k], [i + block_width - 1, j + block_width - 1, k + block_height - 1], texture);
                }
            }
        }

    }

    run() {
        this.camera.update();

        this.chunkNode.run();
        this.edit.run();
        this.rtLightNode.run();
        this.rtGINode.run();
        this.output.run();

        if (this.placeVoxel) {
            const p = this.camera.position;
            const start = [Math.floor(p[0] * -1024 + 512), Math.floor(p[1] * -1024 + 512), Math.floor(p[2] * -1024 + 512)];
            const end = [start[0] + 7, start[1] + 7, start[2] + 7];
            this.grid.modify(start, end, 1);
        }
    }

    meshesIncoming(meshes) {

    }
}