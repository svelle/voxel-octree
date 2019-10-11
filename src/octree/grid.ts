import {spawn, Worker, Transfer, expose, Pool} from "threads/dist";
import {modify} from "./worker/node";
import {map3D1D} from "./util";
import {Chunk, Mesh} from "./chunk";
import {Observable} from "threads/dist/observable";
import {MeshGeneratorWorker} from "./worker/mesh-generator";


const queue: Chunk[] = [];
const chunks: { [key: number]: Chunk } = {};
const meshes: { [key: number]: Mesh } = {};
const lockedBuffer: { [key: number]: boolean } = {};
const scale = 1024;
let meshObserver;
let pool;
let results = [];

function getChunkID(position: number[]): number[] {
	return [
		Math.floor(position[0] / scale),
		Math.floor(position[1] / scale),
		Math.floor(position[2] / scale)
	];
}

function getChuckByID(chunkID: number[]): Chunk {
	return chunks[map3D1D(chunkID)];
}

function updateMesh(chunk: Chunk) {
	if (queue.findIndex(c =>
		c.id[0] === chunk.id[0] &&
		c.id[1] === chunk.id[1] &&
		c.id[2] === chunk.id[2]
	) === -1) {
		queue.push(chunk);
	}
}

function balanceWork() {

	while (queue[0]) {
		const chunk = queue[0];
		const chunkID = map3D1D(chunk.id);
		const chunkMesh = meshes[chunkID];

		if (lockedBuffer[chunkID]) {
			break;
		}

		queue.shift();

		lockedBuffer[chunkID] = true;
		pool.queue(async worker => {
			worker.work(chunk.id, JSON.stringify(chunks), chunkMesh.mesh ? chunkMesh.mesh : undefined).then((mesh) => {
				if (!chunkMesh.mesh) {
					chunkMesh.mesh = mesh.mesh;
				}
				chunkMesh.vertexCount = mesh.vertexCount;
				results.push({
					mesh: mesh.mesh,
					id: chunk.id,
					vertexCount: chunkMesh.vertexCount
				});
			});
		})
	}
}


const octreeGrid = {

	async initThreads() {
		const maxWorkerThreads = Math.max(1, navigator.hardwareConcurrency -2);
		pool = Pool(() => spawn<MeshGeneratorWorker>(new Worker("./worker/mesh-generator")), maxWorkerThreads)
	},

	meshChanges() {
		return new Observable(observer => {
			meshObserver = observer;
		})
	},

	meshUploaded(id: number) {
		lockedBuffer[id] = false;
		balanceWork()
	},

	async modify(p1: number[], p2: number[], value: number) {

		const startChunkIDCoords = getChunkID(p1);
		const endChunkIDCoords = getChunkID(p2);

		for (let x = startChunkIDCoords[0]; x <= endChunkIDCoords[0]; x++) {
			for (let y = startChunkIDCoords[1]; y <= endChunkIDCoords[1]; y++) {
				for (let z = startChunkIDCoords[2]; z <= endChunkIDCoords[2]; z++) {

				    const chunkAbsStartX = x * scale;
				    const chunkAbsEndX = (x + 1) * scale -1;
                    const chunkAbsStartY = y * scale;
                    const chunkAbsEndY = (y + 1) * scale -1;
                    const chunkAbsStartZ = z * scale;
                    const chunkAbsEndZ = (z + 1) * scale -1;

                    const relStartPoint = [
                        p1[0] > chunkAbsStartX ? p1[0] - chunkAbsStartX : 0,
                        p1[1] > chunkAbsStartY ? p1[1] - chunkAbsStartY : 0,
                        p1[2] > chunkAbsStartZ ? p1[2] - chunkAbsStartZ : 0
                    ];

                    const relEndPoint = [
                        p2[0] <= chunkAbsEndX ? p2[0] % scale : scale - 1,
                        p2[1] <= chunkAbsEndY ? p2[1] % scale : scale - 1,
                        p2[2] <= chunkAbsEndZ ? p2[2] % scale : scale - 1
                    ];

					relEndPoint[0] = relEndPoint[0] < 0 ? 1024 + relEndPoint[0] : relEndPoint[0]
					relEndPoint[1] = relEndPoint[1] < 0 ? 1024 + relEndPoint[1] : relEndPoint[1]
					relEndPoint[2] = relEndPoint[2] < 0 ? 1024 + relEndPoint[2] : relEndPoint[2]

                    const id = [x, y, z];
                    let chunk = chunks[map3D1D(id)];

                    if (!chunk) {
						let tree = { data: 0 };
						chunk = chunks[map3D1D(id)] = {
							id,
							tree
						};

						meshes[map3D1D(id)] = {
							id,
							mesh: null
						}
					}

                    const info = {
						size: scale,
						node: chunk.tree,
						position: [0, 0, 0],
						depth: 0
					};

                    modify(info, relStartPoint, relEndPoint, value);

					updateMesh(chunk);
				}
			}
		}
		balanceWork();
	},

	getNext() {
		return results.shift();
	}

};

export type OctreeGrid = typeof octreeGrid;
expose(octreeGrid);