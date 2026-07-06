import type { Asset, ModelAssetFormat } from "@pixi-board/board-domain";
import { assetLabel } from "./assetLabels";
import { encodeCanvasDerivative } from "./mediaPreview";
import { resolveModelPreviewSource } from "./modelPreviewSource";
import type {
  ModelPreviewResult,
  ThreeBufferGeometry,
  ThreeNamespace,
  ThreeObject,
  ThreePerspectiveCamera,
} from "./modelPreviewTypes";
import { staticPreviewMetadataFor } from "./staticPreviewMetadata";

const MODEL_PREVIEW_BACKGROUND = 0xe8edf3;

export async function renderModelPreview(asset: Asset, url: string): Promise<ModelPreviewResult> {
  const THREE = await import("three");
  const previewMetadata = staticPreviewMetadataFor({
    kind: "model",
    fileName: assetLabel(asset),
  });
  const width = previewMetadata.width ?? 640;
  const height = previewMetadata.height ?? 420;
  const source = await resolveModelPreviewSource(asset, url);
  let object: ThreeObject | null = null;
  let objectUrlToRevoke: string | null = null;

  if (source.bytes) {
    objectUrlToRevoke = URL.createObjectURL(new Blob([new Uint8Array(source.bytes)]));
  }

  const loadUrl = objectUrlToRevoke ?? source.url;
  const { scene, camera, renderer } = createModelScene(THREE, width, height);

  try {
    object = await loadModelObject(THREE, loadUrl, source.format);
    applyFallbackMaterials(THREE, object);
    scene.add(object);
    frameObject(THREE, object, camera);

    renderer.render(scene, camera);
    const derivative = await encodeCanvasDerivative(renderer.domElement);

    return {
      ...derivative,
      metadata: previewMetadata,
    };
  } finally {
    if (object) disposeObject(THREE, object);
    renderer.dispose();
    if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
  }
}

function createModelScene(
  THREE: ThreeNamespace,
  width: number,
  height: number,
): {
  scene: InstanceType<ThreeNamespace["Scene"]>;
  camera: ThreePerspectiveCamera;
  renderer: InstanceType<ThreeNamespace["WebGLRenderer"]>;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(MODEL_PREVIEW_BACKGROUND);

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 10000);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 6);
  const fill = new THREE.DirectionalLight(0xaecbfa, 1.1);
  fill.position.set(-5, 2, 3);
  scene.add(ambient, key, fill);

  return { scene, camera, renderer };
}

async function loadModelObject(
  THREE: ThreeNamespace,
  url: string,
  format: ModelAssetFormat,
): Promise<ThreeObject> {
  switch (format) {
    case "glb":
    case "gltf": {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      return normalizeLoadedModel(THREE, await new GLTFLoader().loadAsync(url));
    }
    case "obj": {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      return normalizeLoadedModel(THREE, await new OBJLoader().loadAsync(url));
    }
    case "fbx": {
      const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
      return normalizeLoadedModel(THREE, await new FBXLoader().loadAsync(url));
    }
    case "stl": {
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      return normalizeLoadedModel(THREE, await new STLLoader().loadAsync(url));
    }
    case "ply": {
      const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
      return normalizeLoadedModel(THREE, await new PLYLoader().loadAsync(url));
    }
    case "dae": {
      const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js");
      return normalizeLoadedModel(THREE, await new ColladaLoader().loadAsync(url));
    }
    case "3mf": {
      const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
      return normalizeLoadedModel(THREE, await new ThreeMFLoader().loadAsync(url));
    }
    case "3ds": {
      const { TDSLoader } = await import("three/examples/jsm/loaders/TDSLoader.js");
      return normalizeLoadedModel(THREE, await new TDSLoader().loadAsync(url));
    }
    case "vrml":
    case "wrl": {
      const { VRMLLoader } = await import("three/examples/jsm/loaders/VRMLLoader.js");
      return normalizeLoadedModel(THREE, await new VRMLLoader().loadAsync(url));
    }
    default:
      throw new Error(`Unsupported model preview format: ${format}`);
  }
}

function normalizeLoadedModel(THREE: ThreeNamespace, loaded: unknown): ThreeObject {
  if (loaded instanceof THREE.Object3D) return loaded;
  if (loaded instanceof THREE.BufferGeometry) return meshFromGeometry(THREE, loaded);

  const maybeScene = loaded as { scene?: unknown };
  if (maybeScene.scene instanceof THREE.Object3D) return maybeScene.scene;
  if (maybeScene.scene instanceof THREE.BufferGeometry) return meshFromGeometry(THREE, maybeScene.scene);

  throw new Error("Loaded model result is not renderable");
}

function meshFromGeometry(THREE: ThreeNamespace, geometry: ThreeBufferGeometry): ThreeObject {
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  return new THREE.Mesh(geometry, createModelMaterial(THREE));
}

function applyFallbackMaterials(THREE: ThreeNamespace, object: ThreeObject): void {
  object.traverse((child) => {
    const mesh = child as { isMesh?: boolean; material?: unknown };
    if (mesh.isMesh && !mesh.material) {
      mesh.material = createModelMaterial(THREE);
    }
  });
}

function createModelMaterial(THREE: ThreeNamespace) {
  return new THREE.MeshStandardMaterial({
    color: 0xb7c0cc,
    roughness: 0.82,
    metalness: 0.08,
  });
}

function frameObject(
  THREE: ThreeNamespace,
  object: ThreeObject,
  camera: ThreePerspectiveCamera,
): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);

  if (
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !Number.isFinite(center.z) ||
    !Number.isFinite(maxDimension) ||
    maxDimension <= 0
  ) {
    throw new Error("Loaded model has no finite bounds");
  }

  object.position.sub(center);
  camera.position.set(maxDimension * 1.25, maxDimension * 0.95, maxDimension * 1.85);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(maxDimension / 1000, 0.01);
  camera.far = maxDimension * 20;
  camera.updateProjectionMatrix();
}

function disposeObject(THREE: ThreeNamespace, object: ThreeObject): void {
  object.traverse((child) => {
    const mesh = child as {
      geometry?: { dispose?: () => void };
      material?: unknown;
    };
    mesh.geometry?.dispose?.();
    disposeMaterial(THREE, mesh.material);
  });
}

function disposeMaterial(THREE: ThreeNamespace, material: unknown): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => disposeMaterial(THREE, entry));
    return;
  }
  if (material instanceof THREE.Material) {
    material.dispose();
  }
}
