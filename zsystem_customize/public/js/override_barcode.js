frappe.provide('zsystem_customize')
frappe.provide('zsystem_customize.utils')
zsystem_customize.utils.BarcodeScanner = class CustomBarcodeScanner extends erpnext.utils.BarcodeScanner {

	scan_api_call(input, callback) {
    // Extract item_code and serial_no from input string
    function parseInput(custom_input) {
        let trimmedInput = custom_input.trim();
        let parts = trimmedInput.split('|');
        let item_code = null;
        let serial_no = null;

        parts.forEach(part => {
            part = part.trim();

            if (part.startsWith("1P")) {
                item_code = part;
            } else if (/^S/.test(part)) {  // Matches anything starting with 'S'
                serial_no = part;
            }
        });

        console.log("Original parts:", parts);

        if (item_code) {
            // Clean item_code by removing '1P' prefix, hyphens and spaces
            item_code = item_code.replace(/^1P/, "").replace(/-/g, "").replace(/\s+/g, "");
            console.log("Parsed Item Code:", item_code);
        } else {
            console.log("No valid '1P' Part Number found.");
        }

        if (serial_no) {
            console.log("Serial Number:", serial_no);
        } else {
            console.log("No valid serial number starting with 'S' found.");
        }

        if (!item_code || !serial_no) {
            return null;
        }

        return { item_code, serial_no };
    }

    // Parse and validate input
    const result = parseInput(input);
    if (!result) {
        this.show_alert("Invalid scan: Must include both 'Part Number' and 'Serial Number'.");
        return;
    }

    // Reference the grid for existing items
    const cur_grid = this.frm.fields_dict[this.items_table_name]?.grid;
    let existing_row = null;

    // Look for existing item by item_code
    if (cur_grid) {
        for (let row of cur_grid.grid_rows) {
            if (row.doc.item_code === result.item_code) {
                existing_row = row.doc;
                break;
            }
        }
    }

    if (existing_row) {
        // Get existing serial numbers as an array
        let current_serials = existing_row.serial_no
            ? existing_row.serial_no.split('\n').map(s => s.trim()).filter(Boolean)
            : [];

        const new_serial = result.serial_no.trim();

        if (!new_serial) {
            this.show_alert(__("Invalid serial number."));
            return;
        }

        // Check for duplicate serial number
        if (current_serials.includes(new_serial)) {
            this.show_alert(__("This serial number is already added for item {0}.", [result.item_code]));
            return;
        }

        // Append new serial number
        current_serials.push(new_serial);
        existing_row.serial_no = current_serials.join('\n');

        // Update quantities
        existing_row.qty = flt(existing_row.qty || 0) + 1;
        existing_row.received_qty = flt(existing_row.received_qty || 0) + 1;

        // Refresh UI
        cur_grid.refresh();
        this.frm.refresh_field(this.items_table_name);

        // Show updated serial numbers
        this.show_alert(__("Updated Serial Numbers:<br><pre>{0}</pre>", [existing_row.serial_no]));

        // Optional callbacks for further processing
        this.show_scan_message?.(existing_row.idx, result.item_code, existing_row.qty);
        this.clean_up?.();

        return;
    }

    // If item doesn't exist in grid, call server API
    frappe.call({
        method: this.scan_api,
        args: { search_value: result.item_code },
    }).then(r => {
        if (r.message?.error) {
            this.show_alert(r.message.error);
        } else {
            // Attach serial number to response and call callback
            r.message.serial_no = result.serial_no;
            callback(r);
        }
    }).catch(err => {
        console.error("Scan failed:", err);
        this.show_alert("Error in scanning: " + err.message);
    });
}

// 	});
// }
	update_table(data) {
		return new Promise((resolve, reject) => {
			let cur_grid = this.frm.fields_dict[this.items_table_name].grid;
			frappe.flags.trigger_from_barcode_scanner = true;

			const { item_code, barcode, batch_no, serial_no, uom } = data;
			let row = this.get_row_to_modify_on_scan(item_code, batch_no, uom, barcode);

			this.is_new_row = false;
			if (!row) {
				if (this.dont_allow_new_row) {
					this.show_alert(__("Maximum quantity scanned for item {0}.", [item_code]), "red");
					this.clean_up();
					reject();
					return;
				}
				this.is_new_row = true;
				row = frappe.model.add_child(this.frm.doc, cur_grid.doctype, this.items_table_name);
				this.frm.script_manager.trigger(`${this.items_table_name}_add`, row.doctype, row.name);
				this.frm.has_items = false;
			}


			if (this.is_duplicate_serial_no(row, serial_no)) {
				this.clean_up();
				reject();
				return;
			}
			
			frappe.run_serially([
				() => this.set_selector_trigger_flag(data),
				() => this.set_item(row, item_code, barcode, batch_no, serial_no).then((qty) => {
					this.show_scan_message(row.idx, row.item_code, qty);
				}),
				() => this.set_barcode_uom(row, uom),
				() => this.set_serial_no(row, serial_no),
				() => this.set_batch_no(row, batch_no),
				() => this.set_barcode(row, barcode),
				() => this.clean_up(),
				() => this.revert_selector_flag(),
				// () => this.frm.save(),
				() => resolve(row),
			]);
		});
	}
	set_serial_no(row, serial_no) {
		// Ensure you're assigning the correct serial_no value
		if (serial_no) {
			row.serial_no = serial_no;
		} else {
			console.log("Serial number not provided");
		}
	
		// Assuming your function is expected to be async, return a resolved promise.
		return Promise.resolve(); 
	}	
};

// Ensure CustomBarcodeScanner replaces the default BarcodeScanner
if (erpnext.utils.BarcodeScanner !== zsystem_customize.utils.BarcodeScanner) {
	erpnext.utils.BarcodeScanner = zsystem_customize.utils.BarcodeScanner;
}

