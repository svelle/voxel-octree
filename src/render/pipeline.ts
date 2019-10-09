import {ChunkNode} from "./node/chunk-node/chunk-node";
import {OutputNode} from "./node/output/output";
import {Camera} from "./camera";
import {OctreeGrid} from "../octree/grid";

export class Pipeline {

	chunkNode: ChunkNode;
	output: OutputNode;
	camera: Camera;

	constructor(public grid: OctreeGrid) {
		this.camera = new Camera();

		this.chunkNode = new ChunkNode(this.camera, grid);
		this.chunkNode.init();

		this.output = new OutputNode(this.chunkNode.frameBuffer.textures[0]);
		this.output.init();

		document.addEventListener("keydown", async (element) => {
			switch (element.key) {
				case "e":
				case "E":
					const p = this.camera.position;
					const start = [Math.floor(p[0] * -1024 + 512), Math.floor(p[1] * -1024 + 512), Math.floor(p[2] * -1024 + 512)];
					const end = [start[0], start[1], start[2]];
					grid.modify(start, end, 1);
			}

		});

		grid.modify([-1024, -1024, 0], [2047, 2047, 63], 1);


	}

	run() {
		this.camera.update();
		this.chunkNode.run();
		this.output.run();
	}

	meshesIncoming(meshes) {

	}
}