(() => {
  // ../zsystem_customize/zsystem_customize/public/js/override_barcode.js
  frappe.provide("zsystem_customize");
  frappe.provide("zsystem_customize.utils");
  zsystem_customize.utils.BarcodeScanner = class CustomBarcodeScanner extends erpnext.utils.BarcodeScanner {
    scan_api_call(input, callback) {
      function removeStartAndEnd(custom_input) {
        return custom_input.replace(/^1P/i, "").replace(/\$$/, "");
      }
      frappe.call({
        method: this.scan_api,
        args: { search_value: removeStartAndEnd(input) }
      }).then((r) => {
        callback(r);
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
  };
  if (erpnext.utils.BarcodeScanner !== zsystem_customize.utils.BarcodeScanner) {
    erpnext.utils.BarcodeScanner = zsystem_customize.utils.BarcodeScanner;
  }
  zsystem_customize.utils.SerialBatchPackageSelector = class customSerialNoBatchBundleUpdate extends erpnext.SerialBatchPackageSelector {
    constructor(frm, item, callback) {
      var _a;
      super(frm, item, callback);
      this.frm = frm;
      this.item = item;
      this.qty = this.item.qty;
      this.callback = callback;
      this.bundle = ((_a = this.item) == null ? void 0 : _a.is_rejected) ? this.item.rejected_serial_and_batch_bundle : this.item.serial_and_batch_bundle;
      if (!this.dialog) {
        this.make();
      }
      this.render_data();
    }
    scan_barcode_data() {
      const { scan_serial_no, scan_batch_no } = this.dialog.get_values();
      let modify_serial_no = scan_serial_no ? scan_serial_no.replace(/\$/g, "") : "";
      console.log("Scanned Serial No:", modify_serial_no);
      this.dialog.set_value("enter_manually", 0);
      this.validate_qty().then(() => {
        if (scan_serial_no || scan_batch_no) {
          frappe.call({
            method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.is_serial_batch_no_exists",
            args: {
              item_code: this.item.item_code,
              type_of_transaction: this.item.type_of_transaction,
              serial_no: modify_serial_no,
              batch_no: scan_batch_no
            },
            callback: (r) => {
              this.update_serial_batch_no(modify_serial_no, scan_batch_no);
            }
          });
        }
      }).catch((err) => {
        console.error("Validation failed:", err);
      });
    }
    update_serial_batch_no(modify_serial_no, scan_batch_no) {
      let qty = this.dialog.get_value("qty");
      let serial_count = this.dialog.fields_dict.entries.df.data.length;
      if (serial_count >= qty) {
        if (!frappe.flags.norepeat) {
          frappe.flags.norepeat = 1;
          return frappe.msgprint(__(`The scanned serial numbers (${serial_count}) are less than the required quantity (${qty}). Please scan more.`));
        }
      } else {
        if (modify_serial_no) {
          let existing_row = this.dialog.fields_dict.entries.df.data.find((d) => d.serial_no === modify_serial_no);
          if (existing_row) {
            frappe.throw(__("Serial No {0} already exists", [modify_serial_no]));
          }
          if (!this.item.has_batch_no) {
            const args = {
              serial_no: modify_serial_no
            };
            this.dialog.fields_dict.entries.df.data.push(args);
          } else {
            frappe.call({
              method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.get_batch_no_from_serial_no",
              args: { serial_no: modify_serial_no },
              callback: (r) => {
                const args = {
                  serial_no: modify_serial_no,
                  batch_no: r.message
                };
                this.dialog.fields_dict.entries.df.data.push(args);
                this.dialog.fields_dict.entries.grid.refresh();
              }
            });
          }
          this.dialog.fields_dict.scan_serial_no.set_value("");
        } else if (scan_batch_no) {
          let existing_row = this.dialog.fields_dict.entries.df.data.find((d) => d.batch_no === scan_batch_no);
          if (existing_row) {
            existing_row.qty += 1;
          } else {
            this.dialog.fields_dict.entries.df.data.push({
              batch_no: scan_batch_no,
              qty: 1
            });
          }
          this.dialog.fields_dict.scan_batch_no.set_value("");
        }
        this.update_scan_count();
        this.dialog.fields_dict.entries.grid.refresh();
      }
    }
    update_scan_count() {
      let serial_count = this.dialog.fields_dict.entries.df.data.filter((d) => d.serial_no).length;
      let batch_count = this.dialog.fields_dict.entries.df.data.filter((d) => d.batch_no).length;
      let qty = this.dialog.get_value("qty");
      let primary_button = this.dialog.get_primary_btn();
      if (serial_count == qty) {
        primary_button.prop("disabled", false);
        return;
      } else if (serial_count < qty) {
        primary_button.prop("disabled", true);
      }
      this.dialog.set_value("scanned_serial_count", serial_count);
      this.dialog.set_value("scanned_batch_count", batch_count);
      console.log(`Total Serial Numbers Scanned: ${serial_count}`);
      console.log(`Total Batch Numbers Scanned: ${batch_count}`);
    }
    make() {
      var _a, _b, _c, _d, _e;
      let label = ((_a = this.item) == null ? void 0 : _a.has_serial_no) ? __("Serial Nos") : __("Batch Nos");
      let primary_label = this.bundle ? __("Update") : __("Add");
      if (((_b = this.item) == null ? void 0 : _b.has_serial_no) && ((_c = this.item) == null ? void 0 : _c.has_batch_no)) {
        label = __("Serial Nos / Batch Nos");
      }
      primary_label += " " + label;
      this.dialog = new frappe.ui.Dialog({
        title: ((_d = this.item) == null ? void 0 : _d.title) || primary_label,
        size: "large",
        fields: this.get_dialog_fields(),
        primary_action_label: primary_label,
        primary_action: () => this.update_bundle_entries(),
        secondary_action_label: __("Edit Full Form"),
        secondary_action: () => this.edit_full_form()
      });
      this.dialog.show();
      this.$scan_btn = this.dialog.$wrapper.find(".link-btn");
      this.$scan_btn.css("display", "inline");
      let qty = this.item.stock_qty || this.item.transfer_qty || this.item.qty;
      if ((_e = this.item) == null ? void 0 : _e.is_rejected) {
        qty = this.item.rejected_qty;
      }
      qty = Math.abs(qty);
      if (qty > 0) {
        this.dialog.set_value("qty", qty).then(() => {
          if (this.item.serial_no && !this.item.serial_and_batch_bundle) {
            let serial_nos = this.item.serial_no.split("\n");
            if (serial_nos.length > 1) {
              serial_nos.forEach((serial_no) => {
                this.dialog.fields_dict.entries.df.data.push({
                  serial_no,
                  batch_no: this.item.batch_no
                });
              });
            } else {
              this.dialog.set_value("scan_serial_no", this.item.serial_no);
            }
            frappe.model.set_value(this.item.doctype, this.item.name, "serial_no", "");
          } else if (this.item.batch_no && !this.item.serial_and_batch_bundle) {
            this.dialog.set_value("scan_batch_no", this.item.batch_no);
            frappe.model.set_value(this.item.doctype, this.item.name, "batch_no", "");
          }
          this.dialog.fields_dict.entries.grid.refresh();
        });
      }
    }
    get_dialog_fields() {
      var _a;
      let fields = [];
      fields.push({
        fieldtype: "Link",
        fieldname: "warehouse",
        label: __("Warehouse"),
        options: "Warehouse",
        default: this.get_warehouse(),
        onchange: () => {
          var _a2;
          if ((_a2 = this.item) == null ? void 0 : _a2.is_rejected) {
            this.item.rejected_warehouse = this.dialog.get_value("warehouse");
          } else {
            this.item.warehouse = this.dialog.get_value("warehouse");
          }
          this.get_auto_data();
        },
        get_query: () => {
          return {
            filters: {
              is_group: 0,
              company: this.frm.doc.company
            }
          };
        }
      });
      fields.push({
        fieldtype: "Column Break"
      });
      fields.push({
        fieldtype: "Data",
        fieldname: "barcode_scanner",
        options: "Barcode",
        label: __("Scan Barcode"),
        onchange: () => this.scan_barcode()
      });
      fields.push({
        fieldtype: "Section Break"
      });
      fields.push({
        fieldtype: "Data",
        fieldname: "qty",
        label: __("Quantity")
      });
      if (this.frm.doc.doctype === "Stock Entry" && this.frm.doc.purpose === "Manufacture") {
        fields.push({
          fieldtype: "Column Break"
        });
        fields.push({
          fieldtype: "Link",
          fieldname: "work_order",
          label: __("For Work Order"),
          options: "Work Order",
          read_only: 1,
          default: this.frm.doc.work_order
        });
        fields.push({
          fieldtype: "Section Break"
        });
      }
      fields.push({
        fieldtype: "Column Break"
      });
      if (this.item.has_serial_no) {
        fields.push({
          fieldtype: "Data",
          options: "Barcode",
          fieldname: "scan_serial_no",
          label: __("Scan Serial No"),
          get_query: () => {
            return {
              filters: this.get_serial_no_filters()
            };
          },
          onchange: () => this.scan_barcode_data()
        });
      }
      if (this.item.has_batch_no && !this.item.has_serial_no) {
        fields.push({
          fieldtype: "Data",
          options: "Barcode",
          fieldname: "scan_batch_no",
          label: __("Scan Batch No"),
          onchange: () => this.scan_barcode_data()
        });
      }
      fields.push({
        fieldtype: "Section Break"
      });
      if (((_a = this.item) == null ? void 0 : _a.type_of_transaction) === "Outward") {
        fields = [...this.get_filter_fields(), ...fields];
      } else {
        fields = [...fields, ...this.get_attach_field()];
      }
      fields.push({
        fieldtype: "Section Break",
        depends_on: "eval:doc.enter_manually !== 1 || doc.entries?.length > 0"
      });
      fields.push({
        fieldname: "entries",
        fieldtype: "Table",
        allow_bulk_edit: true,
        depends_on: "eval:doc.enter_manually !== 1 || doc.entries?.length > 0",
        data: [],
        fields: this.get_dialog_table_fields()
      });
      return fields;
    }
    scan_barcode() {
      frappe.flags.dialog_set = false;
      const input = cur_dialog.fields_dict.barcode_scanner.value;
      console.log("input", input);
      if (!input) {
        return;
      }
      this.scan_api_call(input, (r) => {
        const data = r && r.message;
        if (!data || Object.keys(data).length === 0) {
          frappe.msgprint(__("Cannot find Item with this Barcode"));
          return;
        }
        console.log("Scanned Data:", data);
        this.update_qty(data).then((row) => {
          this.play_success_sound();
        }).catch(() => {
          this.play_fail_sound();
        });
      });
    }
    scan_api_call(input, callback) {
      function removeStartAndEnd(custom_input) {
        return custom_input.replace(/^1P/i, "").replace(/\$$/, "");
      }
      frappe.call({
        method: "erpnext.stock.utils.scan_barcode",
        args: { search_value: removeStartAndEnd(input) }
      }).then((r) => {
        callback(r);
      });
      this.dialog.fields_dict.barcode_scanner.set_value("");
    }
    update_qty(res) {
      return new Promise((resolve, reject) => {
        let scanned_value = res.item_code;
        let item_value = this.item.item_code;
        if (scanned_value === item_value) {
          let update_qty = this.dialog.get_value("qty");
          this.dialog.set_value("qty", update_qty + 1);
          resolve();
        } else {
          frappe.msgprint(__("Cannot find Item with this Barcode"));
        }
      });
    }
    play_success_sound() {
      this.success_sound && frappe.utils.play_sound(this.success_sound);
    }
    play_fail_sound() {
      this.fail_sound && frappe.utils.play_sound(this.fail_sound);
    }
    render_data() {
      if (this.bundle || this.frm.doc.is_return) {
        frappe.call({
          method: "erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.get_serial_batch_ledgers",
          args: {
            item_code: this.item.item_code,
            name: this.bundle,
            voucher_no: !this.frm.is_new() ? this.item.parent : "",
            child_row: this.frm.doc.is_return ? this.item : ""
          }
        }).then((r) => {
          if (r.message) {
            this.set_data(r.message);
          }
        });
      }
    }
    set_data(data) {
      var _a;
      data.forEach((d) => {
        d.qty = Math.abs(d.qty);
        d.name = d.child_row || d.name;
        this.dialog.fields_dict.entries.df.data.push(d);
      });
      this.dialog.fields_dict.entries.grid.refresh();
      if ((_a = this.dialog.fields_dict.entries.df.data) == null ? void 0 : _a.length) {
        this.dialog.set_value("enter_manually", 0);
      }
    }
    validate_qty() {
      return new Promise((resolve, reject) => {
        let qty = this.dialog.get_value("qty");
        let serial_count = this.dialog.fields_dict.entries.df.data.length;
        if (serial_count > qty) {
          reject(__(`Mismatch: The scanned serial numbers (${serial_count}) are less than the required quantity (${qty}). Please scan more.`));
        }
        resolve("You can continue");
      });
    }
    get_filter_fields() {
      return [
        {
          fieldtype: "Section Break"
        }
      ];
    }
  };
  if (!(erpnext.SerialBatchPackageSelector instanceof zsystem_customize.utils.SerialBatchPackageSelector)) {
    erpnext.SerialBatchPackageSelector = zsystem_customize.utils.SerialBatchPackageSelector;
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
        let item_code = this.dialog.get_value("item_code");
        if (item_code) {
          let updated_code = item_code.replace(/^1P/i, "").replace(/\$$/, "");
          this.dialog.set_value("item_code", updated_code);
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
        let cleaned = row.barcode.replace(/1P/g, "").replace(/\$/g, "").replace(/-/g, "");
        frappe.model.set_value(cdt, cdn, "barcode", cleaned);
      }
    }
  });
})();
//# sourceMappingURL=zsystem_customize.bundle.EBDU5G64.js.map
