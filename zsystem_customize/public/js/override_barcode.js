frappe.provide('zsystem_customize')
frappe.provide('zsystem_customize.utils')
zsystem_customize.utils.BarcodeScanner = class CustomBarcodeScanner extends erpnext.utils.BarcodeScanner {

	scan_api_call(input, callback) {
		function removeStartAndEnd(custom_input) {
			let item_input = custom_input.trim(); // Clean leading/trailing spaces
			let parts = item_input.split('|');
			let item_code = null;
			let serial_no = null;
	
			// parts.forEach(part => {
			// 	part = part.trim();
	
			// 	if (part.startsWith("1P") && part.length >= 20) {
			// 		item_code = part.substring(0, 20);
			// 	} else if (part.startsWith("S") && part.length >= 11) {
			// 		serial_no = part.substring(0, 11);
			// 	}
			// });
			parts.forEach(part => {
				part = part.trim();

				if (part.startsWith("1P")) {
					item_code = part;
				} else if (part.startsWith("S")) {
					serial_no = part;
				}
			});
			console.log("Original:", parts);
	
			if (item_code) {
				item_code = item_code.replace(/^1P/, "").replace(/-/g, "").replace(/\s+/g, "");
				console.log("Part Number (Item Code):", item_code);
			} else {
				console.log("No valid 1P Part Number  found.");
			}
	
			if (serial_no) {
				console.log("S (10 chars):", serial_no);
			} else {
				console.log("No valid S+10 found.");
			}
	
			if (!item_code || !serial_no) {
				return null;
			}
			
			return { item_code, serial_no };
		}
	
		// Remove start and end and validate
		const result = removeStartAndEnd(input);
		if (!result) {
			frappe.msgprint("Invalid scan: Must include '1P' (20 chars) and 'SC-' (10 chars).");
			return;
		}
		// const { item_code, serial_no } = result;

	// // Step 1: Validate scanned item_code exists in Item Barcode table
	// frappe.call({
	// 	method: "frappe.client.get_list",
	// 	args: {
	// 		doctype: "Item Barcode",
	// 		fields: ["parent", "barcode"],
	// 		filters: { barcode: item_code },
	// 		limit_page_length: 1
	// 	},
	// 	callback: (r) => {
	// 		if (!(r.message && r.message.length > 0)) {
	// 			frappe.msgprint("Scanned item code not found in Item master.");
	// 			return; // ❌ Stop if not found
	// 		}

	// 		// ✅ Valid item
	// 		const item_name = r.message[0].parent;
	// 		console.log("Matched Item:", item_name);
	// 		frm.set_value("item_code", item_name);
	// 		frm.set_value("serial_no", serial_no);

			// Handle existing row in the grid
			let cur_grid = this.frm.fields_dict[this.items_table_name].grid;
			let existing_row = null;
		
			// Find the existing item row by item_code
			for (let row of cur_grid.grid_rows) {
				let doc = row.doc;
				if (doc.item_code === result.item_code) {
					existing_row = doc;
					break;
				}
			}
		
			if (existing_row) {
				// Get and clean existing serial numbers
				let current_serials = existing_row.serial_no
					? existing_row.serial_no.split('\n').map(s => s.trim()).filter(Boolean)
					: [];
		
				// Get and clean the new serial number
				let new_serial = result.serial_no ? result.serial_no.trim() : "";
		
				// Validate new serial number
				if (!new_serial) {
					frappe.msgprint(__("Invalid serial number."));
					return;
				}
		
				// Check for duplicates
				if (current_serials.includes(new_serial)) {
					frappe.msgprint(__("This serial number is already added for item {0}.", [result.item_code]));
					return;
				}
		
				// Append new serial and update field
				current_serials.push(new_serial);
				existing_row.serial_no = current_serials.join('\n'); // Store as multiline string
		
				// Update quantity
				existing_row.qty = flt(existing_row.qty || 0) + 1;
		
				// Refresh UI
				if (cur_grid) cur_grid.refresh();
				this.frm.refresh_field(this.items_table_name);
		
				// Show updated serial list
				frappe.msgprint(__("Updated Serial Numbers:<br><pre>{0}</pre>", [existing_row.serial_no]));
		
				// Continue scanning process
				this.show_scan_message?.(existing_row.idx, result.item_code, existing_row.qty);
				this.clean_up?.();
		
				return;
			}

			// If item doesn't exist, call the API
			frappe.call({
				method: this.scan_api,
				args: { search_value: result.item_code },
			}).then((r) => {
				if (r.message?.error) {
					frappe.msgprint(r.message.error);
				} else {
					// Attach serial_no and pass to callback
					r.message.serial_no = result.serial_no;
					callback(r);
				}
			}).catch((err) => {
				console.log("Scan failed:", err);
				frappe.msgprint("Error in scanning: " + err.message);
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

// zsystem_customize.utils.SerialBatchPackageSelector = class customSerialNoBatchBundleUpdate extends erpnext.SerialBatchPackageSelector {
// 	constructor(frm, item, callback) {
// 		super(frm, item, callback)
// 		this.frm = frm;
// 		this.item = item;
// 		this.qty = this.item.qty;
// 		this.callback = callback;
// 		this.bundle = this.item?.is_rejected
// 			? this.item.rejected_serial_and_batch_bundle
// 			: this.item.serial_and_batch_bundle;

// 		if (!this.dialog) {
// 			this.make();
// 		}
// 		this.render_data();
// 	}

// 	scan_barcode_data() {
// 		const { scan_serial_no, scan_batch_no } = this.dialog.get_values();
// 		if (scan_serial_no && scan_serial_no.startsWith("1P")) {
// 			if (!frappe.flags.norepeat) {
// 				frappe.flags.norepeat = true;
// 				frappe.msgprint("Please scan the correct serial number");
// 			}
// 			return ""; // Prevent value from being accepted
// 		}			
// 		else{
			
// 			let modify_serial_no = scan_serial_no ? scan_serial_no.replace(/\$/g, '').replace(/-/g,'') : "";
// 			console.log("Scanned Serial No:", modify_serial_no);
// 			this.dialog.set_value("enter_manually", 0);

// 			this.validate_qty().then(() => {
// 				if (scan_serial_no || scan_batch_no) {
// 					frappe.call({
// 						method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.is_serial_batch_no_exists",
// 						args: {
// 							item_code: this.item.item_code,
// 							type_of_transaction: this.item.type_of_transaction,
// 							serial_no: modify_serial_no,
// 							batch_no: scan_batch_no,
// 						},
// 						callback: (r) => {
// 							this.update_serial_batch_no(modify_serial_no, scan_batch_no);
							
// 						},
// 					});
// 				}
// 			}).catch(err => {
// 				console.error("Validation failed:", err);
// 			});
// 		}
// 	}


// 	update_serial_batch_no(modify_serial_no, scan_batch_no) {
// 			let qty = this.dialog.get_value("qty");
// 			let serial_count = this.dialog.fields_dict.entries.df.data.length;

// 			if (serial_count >= qty) {
// 				if(!frappe.flags.norepeat){
// 					frappe.flags.norepeat = 1;
// 					return frappe.msgprint(__(`The scanned serial numbers (${serial_count}) are less than the required quantity (${qty}). Please scan more.`));
					
// 				}
				
// 			}
			
// 			else{
// 				if (modify_serial_no) {
// 					let existing_row = this.dialog.fields_dict.entries.df.data.find((d) => d.serial_no === modify_serial_no);
		
// 					if (existing_row) {
// 						frappe.throw(__("Serial No {0} already exists", [modify_serial_no]));
// 					}
		
// 					if (!this.item.has_batch_no) {
// 						const args = {
// 							serial_no: modify_serial_no,
// 						};
// 						this.dialog.fields_dict.entries.df.data.push(args);
// 					} else {
// 						frappe.call({
// 							method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.get_batch_no_from_serial_no",
// 							args: { serial_no: modify_serial_no },
// 							callback: (r) => {
// 								const args = {
// 									serial_no: modify_serial_no,
// 									batch_no: r.message,
// 								}
// 								this.dialog.fields_dict.entries.df.data.push(args);
// 								this.dialog.fields_dict.entries.grid.refresh();
// 							},
// 						});
// 					}
// 					this.dialog.fields_dict.scan_serial_no.set_value(""); // Reset field
// 				} else if (scan_batch_no) {
// 					let existing_row = this.dialog.fields_dict.entries.df.data.find((d) => d.batch_no === scan_batch_no);
		
// 					if (existing_row) {
// 						existing_row.qty += 1;
// 					} else {
// 						this.dialog.fields_dict.entries.df.data.push({
// 							batch_no: scan_batch_no,
// 							qty: 1,
// 						});
// 					}
// 					this.dialog.fields_dict.scan_batch_no.set_value("");
// 				}
// 				this.update_scan_count();
// 				this.dialog.fields_dict.entries.grid.refresh();

// 			}
// 	}
	

// 	// Function to count scanned serial numbers and batch numbers
// 	update_scan_count() {
// 		let serial_count = this.dialog.fields_dict.entries.df.data.filter(d => d.serial_no).length;
// 		let batch_count = this.dialog.fields_dict.entries.df.data.filter(d => d.batch_no).length;
// 		let qty = this.dialog.get_value("qty");
// 			let primary_button = this.dialog.get_primary_btn();
// 			if (serial_count == qty) {
// 				primary_button.prop("disabled", false);
// 				return ;
// 			} 
// 			else if (serial_count < qty) {
// 				primary_button.prop("disabled", true);
// 			}
// 		// Update a UI field (ensure you have a field for displaying count in the dialog)
// 		this.dialog.set_value("scanned_serial_count", serial_count);
// 		this.dialog.set_value("scanned_batch_count", batch_count);

// 		console.log(`Total Serial Numbers Scanned: ${serial_count}`);
// 		console.log(`Total Batch Numbers Scanned: ${batch_count}`);
// 	}

// 	make() {

// 		let label = this.item?.has_serial_no ? __("Serial Nos") : __("Batch Nos");
// 		let primary_label = this.bundle ? __("Update") : __("Add");

// 		if (this.item?.has_serial_no && this.item?.has_batch_no) {
// 			label = __("Serial Nos / Batch Nos");
// 		}

// 		primary_label += " " + label;

// 		this.dialog = new frappe.ui.Dialog({
// 			title: this.item?.title || primary_label,
// 			size: "large",
// 			fields: this.get_dialog_fields(),
// 			primary_action_label: primary_label,
// 			primary_action: () => this.update_bundle_entries(),
// 			secondary_action_label: __("Edit Full Form"),
// 			secondary_action: () => this.edit_full_form(),
// 			// static:true,
// 		});

// 		this.dialog.show();
// 		this.$scan_btn = this.dialog.$wrapper.find(".link-btn");
// 		this.$scan_btn.css("display", "inline");

// 		let qty = this.item.stock_qty || this.item.transfer_qty || this.item.qty;

// 		if (this.item?.is_rejected) {
// 			qty = this.item.rejected_qty;
// 		}

// 		qty = Math.abs(qty);
// 		if (qty > 0) {
// 			this.dialog.set_value("qty", qty).then(() => {
// 				if (this.item.serial_no && !this.item.serial_and_batch_bundle) {
// 					let serial_nos = this.item.serial_no.split("\n");
// 					if (serial_nos.length > 1) {
// 						serial_nos.forEach((serial_no) => {
// 							this.dialog.fields_dict.entries.df.data.push({
// 								serial_no: serial_no,
// 								batch_no: this.item.batch_no,
// 							});
// 						});
// 					} else {
// 						this.dialog.set_value("scan_serial_no", this.item.serial_no);
// 					}
// 					frappe.model.set_value(this.item.doctype, this.item.name, "serial_no", "");
// 				} else if (this.item.batch_no && !this.item.serial_and_batch_bundle) {
// 					this.dialog.set_value("scan_batch_no", this.item.batch_no);
// 					frappe.model.set_value(this.item.doctype, this.item.name, "batch_no", "");
// 				}

// 				this.dialog.fields_dict.entries.grid.refresh();
// 			});
// 		}
// 	}
// 	get_dialog_fields() {
// 		let fields = [];

// 		fields.push({
// 			fieldtype: "Link",
// 			fieldname: "warehouse",
// 			label: __("Warehouse"),
// 			options: "Warehouse",
// 			default: this.get_warehouse(),
// 			onchange: () => {
// 				if (this.item?.is_rejected) {
// 					this.item.rejected_warehouse = this.dialog.get_value("warehouse");
// 				} else {
// 					this.item.warehouse = this.dialog.get_value("warehouse");
// 				}

// 				this.get_auto_data();
// 			},
// 			get_query: () => {
// 				return {
// 					filters: {
// 						is_group: 0,
// 						company: this.frm.doc.company,
// 					},
// 				};
// 			},
// 		});
// 		fields.push({
// 			fieldtype: "Column Break",
// 		});

// 		fields.push({
// 			fieldtype: "Data",
// 			fieldname: "barcode_scanner",
// 			options: "Barcode",
// 			label: __("Scan Barcode"),
// 			onchange: () => this.scan_barcode(),
// 		});

// 		fields.push({
// 			fieldtype: "Section Break",
// 		});
// 		fields.push({
// 			fieldtype: "Data",
// 			fieldname: "qty",
// 			label: __("Quantity"),
// 			// read_only: 1
// 		});

// 		if (this.frm.doc.doctype === "Stock Entry" && this.frm.doc.purpose === "Manufacture") {
// 			fields.push({
// 				fieldtype: "Column Break",
// 			});

// 			fields.push({
// 				fieldtype: "Link",
// 				fieldname: "work_order",
// 				label: __("For Work Order"),
// 				options: "Work Order",
// 				read_only: 1,
// 				default: this.frm.doc.work_order,
// 			});

// 			fields.push({
// 				fieldtype: "Section Break",
// 			});
// 		}

// 		fields.push({
// 			fieldtype: "Column Break",
// 		});

// 		if (this.item.has_serial_no) {
// 			fields.push({
// 				fieldtype: "Data",
// 				options: "Barcode",
// 				fieldname: "scan_serial_no",
// 				label: __("Scan Serial No"),
// 				get_query: () => {
// 					return {
// 						filters: this.get_serial_no_filters(),
// 					};
// 				},
// 				onchange: () => this.scan_barcode_data(),
// 			});
// 		}

// 		if (this.item.has_batch_no && !this.item.has_serial_no) {
// 			fields.push({
// 				fieldtype: "Data",
// 				options: "Barcode",
// 				fieldname: "scan_batch_no",
// 				label: __("Scan Batch No"),
// 				onchange: () => this.scan_barcode_data(),
// 			});
// 		}
// 		fields.push({
// 			fieldtype: "Section Break",
// 		});
// 		if (this.item?.type_of_transaction === "Outward") {
// 			fields = [...this.get_filter_fields(), ...fields];
// 		} else {
// 			fields = [...fields, ...this.get_attach_field()];
// 		}

// 		fields.push({
// 			fieldtype: "Section Break",
// 			depends_on: "eval:doc.enter_manually !== 1 || doc.entries?.length > 0",
// 		});

// 		fields.push({
// 			fieldname: "entries",
// 			fieldtype: "Table",
// 			allow_bulk_edit: true,
// 			depends_on: "eval:doc.enter_manually !== 1 || doc.entries?.length > 0",
// 			data: [],
// 			fields: this.get_dialog_table_fields(),
// 		});

// 		return fields;
// 	}
// 	//Scan Barcode
// 	scan_barcode() {
// 		frappe.flags.dialog_set = false;

// 		const input = cur_dialog.fields_dict.barcode_scanner.value;
// 		console.log("input", input);
// 		if (!input) {
// 			// frappe.msgprint(__("Please scan a barcode"));
// 			return;
// 		}

// 		this.scan_api_call(input, (r) => {
// 			const data = r && r.message;
// 			if (!data || Object.keys(data).length === 0) {
// 				frappe.msgprint(__("Cannot find Item with this Barcode"));
// 				return;
// 			}
// 			console.log("Scanned Data:", data);
// 			// Handle successful barcode scan data here
// 			this.update_qty(data)
// 				.then((row) => {
// 					this.play_success_sound();
// 				})
// 				.catch(() => {
// 					this.play_fail_sound();
// 				});
// 		});

// 	}

// 	scan_api_call(input, callback) {
// 		function removeStartAndEnd(custom_input) {
// 			return custom_input.replace(/^1P/i, '').replace(/\$$/, '').replace(/-/g,'');
// 		}

// 		frappe.call({
// 			method: "erpnext.stock.utils.scan_barcode",  // Replace with your actual method
// 			args: { search_value: removeStartAndEnd(input) },
// 		}).then((r) => {
// 			callback(r);
// 		});
// 		this.dialog.fields_dict.barcode_scanner.set_value("");
// 	}
// 	update_qty(res) {
// 		return new Promise((resolve, reject) => {
// 			let scanned_value = res.item_code;
// 			let item_value = this.item.item_code;
// 			if (scanned_value === item_value) {
// 				let update_qty = this.dialog.get_value("qty")
// 				this.dialog.set_value("qty", parseInt(update_qty) + 1);
// 				resolve()
// 			}
// 			else{
// 				frappe.msgprint(__("Cannot find Item with this Barcode"));
// 			}
			
// 		})
// 	}
// 	play_success_sound() {
// 		this.success_sound && frappe.utils.play_sound(this.success_sound);
// 	}

// 	play_fail_sound() {
// 		this.fail_sound && frappe.utils.play_sound(this.fail_sound);
// 	}

// 	render_data() {
// 		if (this.bundle || this.frm.doc.is_return) {
// 			frappe
// 				.call({
// 					method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.get_serial_batch_ledgers",
// 					args: {
// 						item_code: this.item.item_code,
// 						name: this.bundle,
// 						voucher_no: !this.frm.is_new() ? this.item.parent : "",
// 						child_row: this.frm.doc.is_return ? this.item : "",
// 					},
// 				})
// 				.then((r) => {
// 					if (r.message) {
// 						this.set_data(r.message);
// 					}
// 				});
// 		}
// 	}
// 	set_data(data) {
// 		data.forEach((d) => {
// 			d.qty = Math.abs(d.qty);
// 			d.name = d.child_row || d.name;
// 			this.dialog.fields_dict.entries.df.data.push(d);
// 		});

// 		this.dialog.fields_dict.entries.grid.refresh();
// 		if (this.dialog.fields_dict.entries.df.data?.length) {
// 			this.dialog.set_value("enter_manually", 0);
// 		}
// 	}

// 	validate_qty() {
// 		return new Promise((resolve, reject) => {
// 			let qty = this.dialog.get_value("qty");
// 			let serial_count = this.dialog.fields_dict.entries.df.data.length;

// 			if (serial_count > qty) {
// 				reject(__(`Mismatch: The scanned serial numbers (${serial_count}) are less than the required quantity (${qty}). Please scan more.`));

// 				// frappe.throw(__(`Mismatch: The scanned serial numbers (${serial_count}) are less than the required quantity (${qty}). Please scan more.`));
// 			}
// 			resolve("You can continue");
// 		})

// 	}
// 	get_filter_fields() {
// 		return [
// 			// {
// 			// 	fieldtype: "Section Break",
// 			// 	label: __("Auto Fetch"),
// 			// },
// 			// {
// 			// 	fieldtype: "Column Break",
// 			// },
			
// 			{
// 				fieldtype: "Section Break",
// 			},
// 		];
// 	}

// }
// if (!(erpnext.SerialBatchPackageSelector instanceof zsystem_customize.utils.SerialBatchPackageSelector)) {
// 	erpnext.SerialBatchPackageSelector = zsystem_customize.utils.SerialBatchPackageSelector;
// }

