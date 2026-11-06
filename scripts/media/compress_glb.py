"""Re-export a glTF with Draco compression and portfolio-friendly materials.

blender --background --factory-startup --python scripts/media/compress_glb.py -- IN.glb OUT.glb [ROT_X_DEG]
ROT_X_DEG turns a Y-up CAD export (Fusion 360 default) upright, e.g. -90.
Prints object/material statistics. Keeps source colours; adds metal/roughness by brightness.
"""
import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
src, out = args[0], args[1]
rot_x = float(args[2]) if len(args) > 2 else 0.0
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if rot_x:
    from mathutils import Matrix
    turn = Matrix.Rotation(math.radians(rot_x), 4, "X")
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = turn @ o.matrix_world
    bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print("OBJECTS", len(meshes), "SIZE", tuple(round(v, 3) for v in (hi - lo)))
tris = 0
for o in meshes:
    o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    for poly in o.data.polygons: poly.use_smooth = True
print("TRIS", tris)
for m in bpy.data.materials:
    if not m.use_nodes: continue
    b = m.node_tree.nodes.get("Principled BSDF")
    if not b: continue
    c = b.inputs["Base Color"].default_value
    lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
    sat = max(c[:3]) - min(c[:3])
    print("MAT", m.name, tuple(round(x, 3) for x in c[:3]))
    if sat < .08 and lum > .25:  # neutral light grey -> brushed stainless
        b.inputs["Metallic"].default_value = .85
        b.inputs["Roughness"].default_value = .3
    else:
        b.inputs["Metallic"].default_value = .1
        b.inputs["Roughness"].default_value = .5
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", export_extras=True, export_yup=True,
    export_normals=True, export_texcoords=False, export_materials="EXPORT",
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
    export_cameras=False, export_lights=False,
)
import os
print("WRITTEN", out, round(os.path.getsize(out) / 1e6, 2), "MB")
