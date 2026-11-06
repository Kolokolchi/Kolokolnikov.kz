"""Export the verified ANKOR V05 meshes to compact GLB files for the portfolio WebGL viewer.

Run:  blender --background --factory-startup --python scripts/media/export_machines.py

Read-only for the source project: meshes, placements and colours come from
D:/Anti-Gravity/Матрицы и оборудование/ANKOR_MACHINES_V05 (STL + assemblies/*_manifest.json),
using the same placement rule as that project's src/render_v05.py. Nothing is modelled here.
Every node keeps extras {part, group, step, material} so the viewer can replay the assembly order.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

SOURCE = Path(r"D:/Anti-Gravity/Матрицы и оборудование/ANKOR_MACHINES_V05")
OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "engineering" / "models"
GLASS_PARTS = ("P183", "P185", "B151", "B200")
METAL = {(.72, .74, .76), (.38, .40, .43), (.80, .82, .84), (.74, .56, .26)}
KITS = ("pour", "blister", "product")


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    for coll in (bpy.data.meshes, bpy.data.materials):
        for block in list(coll):
            coll.remove(block)


def material(cache, color, part):
    glass = part.startswith(GLASS_PARTS)
    key = (tuple(round(c, 3) for c in color), glass)
    if key in cache:
        return cache[key]
    m = bpy.data.materials.new(f"{'glass' if glass else 'mat'}_{len(cache)}")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    if glass:
        b.inputs["Alpha"].default_value = .28
        b.inputs["Roughness"].default_value = .05
        m.surface_render_method = "BLENDED"
    else:
        metal = tuple(round(c, 2) for c in color) in METAL
        b.inputs["Metallic"].default_value = .8 if metal else 0
        b.inputs["Roughness"].default_value = .32 if metal else .55
    cache[key] = m
    return m


def mesh(cache, kit, part):
    if part in cache:
        return cache[part]
    bpy.ops.wm.stl_import(filepath=str(SOURCE / "STL" / kit / f"{part}.stl"))
    ob = bpy.context.object
    ob.data.transform(Matrix.Scale(.001, 4))
    data = ob.data
    data.name = part
    bpy.data.objects.remove(ob)
    # Merge STL triangle soup into an indexed mesh and keep hard CAD edges.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(data)
    bm.free()
    for poly in data.polygons:
        poly.use_smooth = True
    try:
        data.set_sharp_from_angle(angle=math.radians(32))
    except AttributeError:
        pass
    cache[part] = data
    return data


def materials_by_label(kit):
    labels = {}
    folder = SOURCE / "assemblies" / kit
    path = folder / "groups.json"
    if path.exists():
        for group, rows in json.loads(path.read_text(encoding="utf-8")).items():
            for row in rows:
                labels[row["name"]] = row.get("material", "")
    return labels


def build(kit):
    clear()
    manifest = json.loads((SOURCE / "assemblies" / f"{kit}_manifest.json").read_text(encoding="utf-8"))
    labels = materials_by_label(kit)
    meshes, mats = {}, {}
    root = bpy.data.objects.new(f"ANKOR_{kit}", None)
    bpy.context.scene.collection.objects.link(root)
    for it in manifest["items"]:
        data = mesh(meshes, kit, it["part"])
        if not data.materials:
            data.materials.append(material(mats, manifest["colors"][it["part"]], it["part"]))
        ob = bpy.data.objects.new(it["label"], data)
        bpy.context.scene.collection.objects.link(ob)
        M = Matrix.Translation(Vector(it["at"]) * .001)
        if it["rot"]:
            M = M @ Matrix.Rotation(math.radians(it["rot"][1]), 4, Vector(it["rot"][0]))
        ob.matrix_world = M
        ob.parent = root
        ob["part"] = it["part"]
        ob["group"] = it["group"]
        ob["step"] = int(it.get("step", 0))
        ob["material"] = labels.get(it["label"], "")
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{kit}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format="GLB", use_selection=False,
        export_extras=True, export_yup=True, export_apply=False,
        export_normals=True, export_texcoords=False, export_materials="EXPORT",
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_cameras=False, export_lights=False,
    )
    tris = sum(len(m.loop_triangles) if m.loop_triangles else (m.calc_loop_triangles() or len(m.loop_triangles)) for m in meshes.values())
    print(f"EXPORTED {kit}: {len(manifest['items'])} nodes, {len(meshes)} meshes, {tris} unique tris -> {target} {target.stat().st_size/1e6:.2f} MB", flush=True)


for kit in KITS:
    build(kit)
