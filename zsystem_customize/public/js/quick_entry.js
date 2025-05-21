frappe.provide("frappe.ui.form");

class ItemQuickEntryForm extends frappe.ui.form.QuickEntryForm {
    render_dialog() {
        super.render_dialog();
        this.setup_custom_onchange();
    }

    setup_custom_onchange() {
        const item_code_field = this.dialog.fields_dict.item_code;

        item_code_field.df.onchange = async () => {
            const input = this.dialog.get_value("item_code");
            if (!input) return;

            function parseItemCode(custom_input) {
                let parts = custom_input.trim().split('|').map(p => p.trim());
                let item_code = parts.find(part => part.toUpperCase().startsWith("1P"));

                if (item_code) {
                    const prefixMatch = item_code.match(/^1P/i);
                    const prefix = prefixMatch ? prefixMatch[0].toUpperCase() : '';

                    // Remove hyphens and spaces only, keep the "1P" prefix intact
                    let cleaned = item_code.slice(prefix.length).replace(/[-\s]/g, '');

                    return cleaned;
                }
                return null;
            }

            const cleaned_item_code = parseItemCode(input);

            if (!cleaned_item_code) {
                this.dialog.set_value("item_code", '');
                frappe.show_alert({
                    message: "Invalid input: No part starts with '1P'.",
                    indicator: 'red'
                });
                return;
            }

            // Check if Item with cleaned_item_code exists in Item doctype
            const exists = await frappe.db.exists('Item', cleaned_item_code);

            if (exists) {
                this.dialog.set_value("item_code", cleaned_item_code);
                frappe.show_alert({
                    message: `Item Code exists: ${cleaned_item_code}`,
                    indicator: 'green'
                });
            } else {
                this.dialog.set_value("item_code", '');
                frappe.show_alert({
                    message: `Item Code not found: ${cleaned_item_code}`,
                    indicator: 'red'
                });
            }
        };
    }
}

frappe.ui.form.ItemQuickEntryForm = ItemQuickEntryForm;
