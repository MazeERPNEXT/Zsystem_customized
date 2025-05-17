(() => {
  // ../zsystem_customize/zsystem_customize/public/js/override_barcode.js
  frappe.provide("zsystem_customize");
  frappe.provide("zsystem_customize.utils");
  zsystem_customize.utils.BarcodeScanner = class CustomBarcodeScanner extends erpnext.utils.BarcodeScanner {
    scan_api_call(input, callback) {
      var _a, _b, _c;
      function parseInput(custom_input) {
        let trimmedInput = custom_input.trim();
        let parts = trimmedInput.split("|");
        let item_code = null;
        let serial_no = null;
        parts.forEach((part) => {
          part = part.trim();
          if (part.startsWith("1P")) {
            item_code = part;
          } else if (/^S/.test(part)) {
            serial_no = part;
          }
        });
        console.log("Original parts:", parts);
        if (item_code) {
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
      const result = parseInput(input);
      if (!result) {
        frappe.msgprint("Invalid scan: Must include both 'Part Number' and 'Serial Number'.");
        return;
      }
      const cur_grid = (_a = this.frm.fields_dict[this.items_table_name]) == null ? void 0 : _a.grid;
      let existing_row = null;
      if (cur_grid) {
        for (let row of cur_grid.grid_rows) {
          if (row.doc.item_code === result.item_code) {
            existing_row = row.doc;
            break;
          }
        }
      }
      if (existing_row) {
        let current_serials = existing_row.serial_no ? existing_row.serial_no.split("\n").map((s) => s.trim()).filter(Boolean) : [];
        const new_serial = result.serial_no.trim();
        if (!new_serial) {
          frappe.msgprint(__("Invalid serial number."));
          return;
        }
        if (current_serials.includes(new_serial)) {
          frappe.msgprint(__("This serial number is already added for item {0}.", [result.item_code]));
          return;
        }
        current_serials.push(new_serial);
        existing_row.serial_no = current_serials.join("\n");
        existing_row.qty = flt(existing_row.qty || 0) + 1;
        existing_row.received_qty = flt(existing_row.received_qty || 0) + 1;
        cur_grid.refresh();
        this.frm.refresh_field(this.items_table_name);
        this.show_alert(__("Updated Serial Numbers:<br><pre>{0}</pre>", [existing_row.serial_no]));
        (_b = this.show_scan_message) == null ? void 0 : _b.call(this, existing_row.idx, result.item_code, existing_row.qty);
        (_c = this.clean_up) == null ? void 0 : _c.call(this);
        return;
      }
      frappe.call({
        method: this.scan_api,
        args: { search_value: result.item_code }
      }).then((r) => {
        var _a2;
        if ((_a2 = r.message) == null ? void 0 : _a2.error) {
          frappe.msgprint(r.message.error);
        } else {
          r.message.serial_no = result.serial_no;
          callback(r);
        }
      }).catch((err) => {
        console.error("Scan failed:", err);
        frappe.msgprint("Error in scanning: " + err.message);
      });
    }
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
          () => resolve(row)
        ]);
      });
    }
    set_serial_no(row, serial_no) {
      if (serial_no) {
        row.serial_no = serial_no;
      } else {
        console.log("Serial number not provided");
      }
      return Promise.resolve();
    }
  };
  if (erpnext.utils.BarcodeScanner !== zsystem_customize.utils.BarcodeScanner) {
    erpnext.utils.BarcodeScanner = zsystem_customize.utils.BarcodeScanner;
  }

  // ../zsystem_customize/zsystem_customize/public/js/quick_entry.js
  var ItemQuickEntryForm = class extends frappe.ui.form.QuickEntryForm {
    render_dialog() {
      super.render_dialog();
      this.remove_car();
    }
    remove_car() {
      let item_code_field = this.dialog.fields_dict.item_code;
      item_code_field.df.onchange = async () => {
        let input = this.dialog.get_value("item_code");
        if (input) {
          let parts = input.split("|").map((p) => p.trim());
          let raw_item_code = parts.find((p) => p.startsWith("1P"));
          if (raw_item_code) {
            let cleaned_code = raw_item_code.replace(/^1P/i, "").replace(/\$/g, "").replace(/[-|]/g, "").trim();
            this.dialog.set_value("item_code", cleaned_code);
          }
        }
      };
    }
  };
  frappe.ui.form.ItemQuickEntryForm = ItemQuickEntryForm;

  // ../zsystem_customize/zsystem_customize/public/js/item.js
  frappe.ui.form.on("Item Barcode", {
    barcode: function(frm, cdt, cdn) {
      let row = locals[cdt][cdn];
      if (row.barcode) {
        let cleaned = row.barcode.replace(/^1P/i, "").replace(/\$$/, "").replace(/-/g, "").replace(/\|/g, "");
        frappe.model.set_value(cdt, cdn, "barcode", cleaned);
      }
    }
  });
})();
//# sourceMappingURL=zsystem_customize.bundle.G2GYTYWG.js.map
