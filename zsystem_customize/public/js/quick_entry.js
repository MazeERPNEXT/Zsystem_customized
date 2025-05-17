
class ItemQuickEntryForm extends frappe.ui.form.QuickEntryForm {
    render_dialog() {
        super.render_dialog();
        this.remove_car();
    }

    remove_car() {
        let item_code_field = this.dialog.fields_dict.item_code;
        
        item_code_field.df.onchange = async () => {
    let input = this.dialog.get_value("item_code");

    if (input) {
        // Find the part that starts with '1P'
        let parts = input.split('|').map(p => p.trim());
        let raw_item_code = parts.find(p => p.startsWith("1P"));

        if (raw_item_code) {
            let cleaned_code = raw_item_code
                .replace(/^1P/i, '')     // Remove '1P' prefix
                .replace(/\$/g, '')      // Remove any '$'
                .replace(/[-|]/g, '')    // Remove '-' and '|'
                .trim();                 // Trim whitespace

            this.dialog.set_value("item_code", cleaned_code);
        }
    }
};
    }
    
}

frappe.ui.form.ItemQuickEntryForm = ItemQuickEntryForm;