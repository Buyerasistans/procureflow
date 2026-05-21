import os
import re
from pathlib import Path

ROOT = Path(r"d:\Projects\procureflow")
ADMIN_PATH = ROOT / "web/src/pages/AdminPage.tsx"

SECTIONS = {
    "onboarding_studio": {
        "component_name": "OnboardingStudioTab",
        "file_path": ROOT / "web/src/pages/admin/OnboardingStudioTab.tsx",
    },
    "tenant_governance": {
        "component_name": "TenantGovernanceTab",
        "file_path": ROOT / "web/src/pages/admin/TenantGovernanceTab.tsx",
    },
}

KEYWORDS = {
    "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
    "false", "finally", "for", "function", "if", "implements", "import", "in",
    "instanceof", "interface", "let", "new", "null", "return", "super", "switch",
    "this", "throw", "true", "try", "typeof", "var", "void", "while", "with",
    "yield", "of", "from",
}
BUILTINS = {
    "Array", "Boolean", "Date", "Error", "JSON", "Math", "Number", "Object",
    "Promise", "RegExp", "String", "Symbol", "Map", "Set", "WeakMap", "WeakSet",
    "Intl", "console", "document", "window", "undefined", "NaN", "Infinity",
    "React",
}
JSX_INTRINSIC = {
    "a","abbr","address","area","article","aside","audio","b","base","bdi","bdo","big","blockquote","body","br","button","canvas","caption","cite","code","col","colgroup","data","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","head","header","hr","html","i","iframe","img","input","ins","kbd","label","legend","li","link","main","map","mark","menu","meta","meter","nav","noscript","object","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strong","style","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr"
}

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def scan_balanced(text: str, start_index: int, open_char="(", close_char=")") -> int:
    depth = 0
    i = start_index
    state = "code"
    quote = None
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                state = "line_comment"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                state = "block_comment"
                i += 2
                continue
            if ch in ("'", '"', "`"):
                state = "string"
                quote = ch
                i += 1
                continue
            if ch == open_char:
                depth += 1
            elif ch == close_char:
                depth -= 1
                if depth == 0:
                    return i
            i += 1
            continue
        if state == "line_comment":
            if ch == "\n":
                state = "code"
            i += 1
            continue
        if state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "code"
                i += 2
            else:
                i += 1
            continue
        if state == "string":
            if ch == "\":
                i += 2
                continue
            if ch == quote:
                state = "code"
            i += 1
            continue
    raise RuntimeError("Unbalanced delimiter scan")

def find_section_block(text: str, key: str) -> tuple[int, int, str]:
    key_match = re.search(rf"['"]{re.escape(key)}['"]", text)
    if not key_match:
        raise RuntimeError(f"Could not find section key {key}")
    idx = key_match.start()
    return_idx = text.find("return", idx)
    if return_idx == -1:
        raise RuntimeError(f"Could not find return for {key}")
    open_paren = text.find("(", return_idx)
    if open_paren == -1:
        raise RuntimeError(f"Could not find opening paren for {key}")
    close_paren = scan_balanced(text, open_paren)
    return return_idx, close_paren + 1, text[open_paren + 1:close_paren]

def extract_imports(text: str) -> list[tuple[str, list[str], bool, str]]:
    imports = []
    for line in text.splitlines():
        m = re.match(r"^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$", line)
        if not m:
            continue
        clause, source = m.group(1), m.group(2)
        default_name = None
        named_names = []
        namespace = False
        if clause.startswith("* as "):
            namespace = True
            default_name = clause[5:].strip()
        else:
            if "," in clause:
                left, right = clause.split(",", 1)
                default_name = left.strip()
                clause = right.strip()
            elif clause.startswith("{"):
                clause = clause.strip()
            else:
                default_name = clause.strip()
                clause = ""
            if clause.startswith("{"):
                inner = clause[1:clause.rfind("}")]
                for part in inner.split(","):
                    part = part.strip()
                    if not part:
                        continue
                    if " as " in part:
                        _, alias = part.split(" as ", 1)
                        named_names.append(alias.strip())
                    else:
                        named_names.append(part)
        names = []
        if default_name:
            names.append(default_name)
        names.extend(named_names)
        imports.append((line, names, namespace, source))
    return imports

def collect_declared_names(text: str) -> set[str]:
    declared = set()
    # Function declarations
    for m in re.finditer(r"\bfunction\s+([A-Za-z_]\w*)\s*\(", text):
        declared.add(m.group(1))
    # Variable declarations
    for m in re.finditer(r"\b(const|let|var)\s+([A-Za-z_]\w*)\s*=", text):
        declared.add(m.group(2))
    # Array destructuring
    for m in re.finditer(r"\b(const|let|var)\s*\[([^\]]+)\]\s*=", text):
        parts = m.group(2).split(",")
        for p in parts:
            name = p.strip()
            if not name:
                continue
            name = name.split("=")[0].strip()
            if name.startswith("..."):
                name = name[3:].strip()
            if re.match(r"^[A-Za-z_]\w*$", name):
                declared.add(name)
    # Object destructuring
    for m in re.finditer(r"\b(const|let|var)\s*\{([^}]+)\}\s*=", text):
        parts = m.group(2).split(",")
        for p in parts:
            name = p.strip()
            if not name:
                continue
            if ":" in name:
                name = name.split(":", 1)[1].strip()
            else:
                name = name.split("=")[0].strip()
            if name.startswith("..."):
                name = name[3:].strip()
            if re.match(r"^[A-Za-z_]\w*$", name):
                declared.add(name)
    # Arrow function params assigned to const
    for m in re.finditer(r"\bconst\s+([A-Za-z_]\w*)\s*=\s*\(", text):
        declared.add(m.group(1))
    return declared

def collect_used_identifiers(block: str) -> set[str]:
    ids = set()
    # Remove JSX tags to reduce noise? We'll filter later.
    for m in re.finditer(r"\b[A-Za-z_]\w*\b", block):
        ids.add(m.group(0))
    return ids

def get_imported_name_map(imports):
    mapping = {}
    for line, names, namespace, source in imports:
        for name in names:
            mapping[name] = (line, source)
    return mapping

def build_component_file(component_name: str, block: str, prop_names: list[str], used_import_lines: list[str]) -> str:
    props_interface = f"{component_name}Props"
    destructured = ", ".join(prop_names)
    props_type_lines = "\n".join([f"  {name}: any;" for name in prop_names]) or "  // no external props required"
    imports_text = "\n".join(sorted(set(used_import_lines)))
    if imports_text:
        imports_text += "\n\n"
    return f"""{imports_text}export interface {props_interface} {{
{props_type_lines}
}}

export default function {component_name}({{ {destructured} }}: {props_interface}) {{
  return (
{block.strip()}
  );
}}
"""

def main():
    admin_text = read_text(ADMIN_PATH)
    imports = extract_imports(admin_text)
    declared = collect_declared_names(admin_text)
    imported_map = get_imported_name_map(imports)

    for key, cfg in SECTIONS.items():
        component_name = cfg["component_name"]
        file_path = cfg["file_path"]

        start, end, block = find_section_block(admin_text, key)

        used_ids = collect_used_identifiers(block)
        # filter identifiers that look like props from component scope
        prop_names = sorted(
            name for name in used_ids
            if name in declared
            and name not in KEYWORDS
            and name not in BUILTINS
            and name not in JSX_INTRINSIC
            and name != component_name
            and not name.startswith("set")
        )

        # collect imported lines used in block
        used_import_lines = []
        for line, names, namespace, source in imports:
            if any(name in used_ids for name in names):
                used_import_lines.append(line)

        # Ensure React import is present if using JSX runtime isn't configured; include if source is react and names used
        component_text = build_component_file(component_name, block, prop_names, used_import_lines)
        write_text(file_path, component_text)

        # Replace the original block with a component invocation
        props_spread = ", ".join(prop_names)
        replacement = f"return <{component_name}{' {...{' + props_spread + '}}' if prop_names else ''} />;"
        admin_text = admin_text[:start] + replacement + admin_text[end:]

        # Update imports in admin file
        import_stmt = f"import {component_name} from './admin/{component_name}';"
        if import_stmt not in admin_text:
            first_import = re.search(r"^import .*?$", admin_text, flags=re.M)
            if first_import:
                insert_at = first_import.start()
                admin_text = admin_text[:insert_at] + import_stmt + "\n" + admin_text[insert_at:]
            else:
                admin_text = import_stmt + "\n" + admin_text

    write_text(ADMIN_PATH, admin_text)

if __name__ == "__main__":
    main()