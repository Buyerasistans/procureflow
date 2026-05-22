import re

file_path = r"d:\Projects\procureflow\web\src\pages\AdminPage.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add CompanyCreateModal import
old_import = (
    'import { PersonnelCreateModal } from "../components/PersonnelCreateModal";'
)
new_import = """import { PersonnelCreateModal } from "../components/PersonnelCreateModal";
import { CompanyCreateModal } from "../components/CompanyCreateModal";"""

content = content.replace(old_import, new_import)

# Update companies state to include showNewCompanyModal
old_companies_state = """  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<{ name: string; description?: string; is_active: boolean; color: string }>({
    name: "",
    is_active: true,
    color: "#3b82f6",
  });"""

new_companies_state = """  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<{ name: string; description?: string; is_active: boolean; color: string }>({
    name: "",
    is_active: true,
    color: "#3b82f6",
  });"""

content = content.replace(old_companies_state, new_companies_state)

# Update the "Yeni Firma" button to toggle modal instead
old_button = """          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowNewCompanyForm(!showNewCompanyForm)}"""

new_button = """          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowNewCompanyModal(true)}"""

content = content.replace(old_button, new_button)

# Update button text
old_button_text = (
    """              {showNewCompanyForm ? "❌ İptal" : "➕ Yeni Firma"}"""
)
new_button_text = '''              "➕ Yeni Firma"'''

content = content.replace(old_button_text, new_button_text)

# Update Detay/Düzenle buttons
old_buttons = """                      <Link
                        to={`/admin/companies/${company.id}`}
                        style={{
                          padding: "4px 12px",
                          marginRight: 8,
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        Düzenle
                      </Link>"""

new_buttons = """                      <Link
                        to={`/admin/companies/${company.id}`}
                        style={{
                          padding: "4px 12px",
                          marginRight: 4,
                          background: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        🔍 Detay
                      </Link>
                      <Link
                        to={`/admin/companies/${company.id}`}
                        style={{
                          padding: "4px 12px",
                          marginRight: 8,
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        ✏️ Düzenle
                      </Link>"""

content = content.replace(old_buttons, new_buttons)

# Add CompanyCreateModal component before the closing div
old_closing = """      {/* Settings Tab */}
      {activeTab === "settings" && <SettingsTab />}
    </div>
  );
}"""

new_closing = """      {/* Settings Tab */}
      {activeTab === "settings" && <SettingsTab />}

      {/* Company Create Modal */}
      <CompanyCreateModal
        isOpen={showNewCompanyModal}
        onClose={() => setShowNewCompanyModal(false)}
        onSuccess={() => {
          loadData();
          setShowNewCompanyModal(false);
        }}
      />
    </div>
  );
}"""

content = content.replace(old_closing, new_closing)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Updated AdminPage.tsx with CompanyCreateModal")
