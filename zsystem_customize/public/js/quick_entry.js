
class ItemQuickEntryForm extends frappe.ui.form.QuickEntryForm {
    render_dialog() {
        super.render_dialog();
        this.remove_car();
    }

    remove_car() {
        let item_code_field = this.dialog.fields_dict.item_code;
        
        item_code_field.df.onchange = async () => {
            let item_code = this.dialog.get_value("item_code");
    
            // Ensure item_code exists before replacing
            if (item_code) {
                let updated_code = item_code.replace(/^1P/i, '').replace(/\$$/, '').replace(/-/g,'');
                
                // Set the updated value back to the field
                this.dialog.set_value("item_code", updated_code);
            }
        };
    }
    
}

frappe.ui.form.ItemQuickEntryForm = ItemQuickEntryForm;