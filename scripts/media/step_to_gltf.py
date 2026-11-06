"""Tessellate a STEP file (single body or assembly) to binary glTF, keeping STEP colours and names.

Run with the CadQuery/OCP environment of the equipment project (read-only use):
  "D:/Anti-Gravity/Матрицы и оборудование/.tools-cad/Scripts/python.exe" scripts/media/step_to_gltf.py SRC.step OUT.glb [linear_mm]
Then compress_glb.py (Blender) applies Draco compression and tidies materials.
"""
import sys
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString, TCollection_AsciiString
from OCP.XCAFApp import XCAFApp_Application
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_LabelSequence
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.RWGltf import RWGltf_CafWriter
from OCP.TColStd import TColStd_IndexedDataMapOfStringString
from OCP.Message import Message_ProgressRange
from OCP.IFSelect import IFSelect_RetDone

src, out = sys.argv[1], sys.argv[2]
linear = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
XCAFApp_Application.GetApplication_s().InitDocument(doc)
reader = STEPCAFControl_Reader()
reader.SetColorMode(True)
reader.SetNameMode(True)
assert reader.ReadFile(src) == IFSelect_RetDone, "STEP read failed"
reader.Transfer(doc)
tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
labels = TDF_LabelSequence()
tool.GetFreeShapes(labels)
for i in range(1, labels.Length() + 1):
    BRepMesh_IncrementalMesh(tool.GetShape_s(labels.Value(i)), linear, False, 0.35, True)
writer = RWGltf_CafWriter(TCollection_AsciiString(out), True)
writer.Perform(doc, TColStd_IndexedDataMapOfStringString(), Message_ProgressRange())
print("written", out, "free shapes:", labels.Length())
