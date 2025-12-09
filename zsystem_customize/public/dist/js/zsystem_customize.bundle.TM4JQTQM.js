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
          if (/^1P\s*/.test(part)) {
            part = part.replace(/^1P\s*/, "1P");
            item_code = part;
          } else if (/^\d*S/.test(part)) {
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
        this.show_alert("Invalid scan: Must include both 'Part Number' and 'Serial Number'.");
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
          this.show_alert(__("Invalid serial number."));
          return;
        }
        if (current_serials.includes(new_serial)) {
          this.show_alert(__("This serial number is already added for item {0}.", [result.item_code]));
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
          this.show_alert(r.message.error);
        } else {
          r.message.serial_no = result.serial_no;
          callback(r);
        }
      }).catch((err) => {
        console.error("Scan failed:", err);
        this.show_alert("Error in scanning: " + err.message);
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
  frappe.provide("frappe.ui.form");
  var ItemQuickEntryForm = class extends frappe.ui.form.QuickEntryForm {
    render_dialog() {
      super.render_dialog();
      this.setup_custom_onchange();
    }
    setup_custom_onchange() {
      const item_code_field = this.dialog.fields_dict.item_code;
      item_code_field.df.onchange = async () => {
        const input = this.dialog.get_value("item_code");
        if (!input)
          return;
        function parseItemCode(custom_input) {
          let parts = custom_input.trim().split("|").map((p) => p.trim());
          let item_code = parts.find((part) => part.toUpperCase().startsWith("1P"));
          if (item_code) {
            let cleaned = item_code.replace(/^1P/i, "").replace(/[-\s]/g, "");
            return cleaned;
          }
          return custom_input;
        }
        const cleaned_item_code = parseItemCode(input);
        if (!cleaned_item_code) {
          this.dialog.set_value("item_code", "");
          frappe.show_alert({
            message: "Invalid input: No part starts with '1P'.",
            indicator: "red"
          });
          return;
        }
        const exists = await frappe.db.exists("Item", cleaned_item_code);
        if (exists) {
          this.dialog.set_value("item_code", "");
          frappe.show_alert({
            message: `Item Code exists: ${cleaned_item_code}`,
            indicator: "green"
          });
        } else {
          this.dialog.set_value("item_code", cleaned_item_code);
          frappe.show_alert({
            message: `Item Code not found: ${cleaned_item_code}`,
            indicator: "red"
          });
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
        let parts = row.barcode.split("|");
        let target = parts.find((p) => /^1P/i.test(p));
        if (target) {
          let cleaned = target.replace(/^1P\s*/, "").replace(/-/g, "");
          cleaned = cleaned;
          frappe.model.set_value(cdt, cdn, "barcode", cleaned);
        }
      }
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/quotation.js
  frappe.provide("zsystem_customize.selling");
  erpnext.sales_common.setup_selling_controller();
  if (!erpnext.set_unit_price_items_note) {
    erpnext.set_unit_price_items_note = function() {
    };
  }
  zsystem_customize.selling.QuotationController = class QuotationController extends erpnext.selling.SellingController {
    refresh() {
      super.refresh();
      let doc = this.frm.doc;
      this.set_dynamic_field_label();
      this.frm.set_df_property("customer_name", "hidden", 1);
      if (doc.docstatus == 1 && !["Lost", "Ordered"].includes(doc.status)) {
        if (frappe.model.can_create("Sales Order") && (frappe.boot.sysdefaults.allow_sales_order_creation_for_expired_quotation || !doc.valid_till || frappe.datetime.get_diff(doc.valid_till, frappe.datetime.get_today()) >= 0)) {
          this.frm.add_custom_button(
            __("Sales Order"),
            () => this.make_sales_order(),
            __("Create")
          );
        }
        if (doc.status !== "Ordered" && this.frm.has_perm("write")) {
          this.frm.add_custom_button(
            __("Set as Lost"),
            () => this.frm.trigger("set_as_lost_dialog")
          );
        }
        cur_frm.page.set_inner_btn_group_as_primary(__("Create"));
      }
    }
    make_sales_order() {
      var me = this;
      let has_alternative_item = this.frm.doc.items.some((item) => item.is_alternative);
      if (has_alternative_item) {
        this.show_alternative_items_dialog();
      } else {
        frappe.model.open_mapped_doc({
          method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
          frm: me.frm
        });
      }
    }
    show_alternative_items_dialog() {
      let me = this;
      const table_fields = [
        {
          fieldtype: "Data",
          fieldname: "name",
          label: __("Name"),
          read_only: 1
        },
        {
          fieldtype: "Link",
          fieldname: "item_code",
          options: "Item",
          label: __("Item Code"),
          read_only: 1,
          in_list_view: 1,
          columns: 2,
          formatter: (value, df, options, doc) => {
            return doc.is_alternative ? `<span class="indicator yellow">${value}</span>` : value;
          }
        },
        {
          fieldtype: "Text Editor",
          fieldname: "description",
          label: __("Description"),
          in_list_view: 1,
          read_only: 1
        },
        {
          fieldtype: "Currency",
          fieldname: "amount",
          label: __("Amount"),
          options: "currency",
          in_list_view: 1,
          read_only: 1
        },
        {
          fieldtype: "Check",
          fieldname: "is_alternative",
          label: __("Is Alternative"),
          read_only: 1
        }
      ];
      this.data = this.frm.doc.items.filter((item) => item.is_alternative || item.has_alternative_item).map((item) => {
        return {
          name: item.name,
          item_code: item.item_code,
          description: item.description,
          amount: item.amount,
          is_alternative: item.is_alternative
        };
      });
      const dialog = new frappe.ui.Dialog({
        title: __("Select Alternative Items for Sales Order"),
        fields: [
          {
            fieldname: "info",
            fieldtype: "HTML",
            read_only: 1
          },
          {
            fieldname: "alternative_items",
            fieldtype: "Table",
            cannot_add_rows: true,
            cannot_delete_rows: true,
            in_place_edit: true,
            reqd: 1,
            data: this.data,
            description: __("Select an item from each set to be used in the Sales Order."),
            get_data: () => {
              return this.data;
            },
            fields: table_fields
          }
        ],
        primary_action: function() {
          frappe.model.open_mapped_doc({
            method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
            frm: me.frm,
            args: {
              selected_items: dialog.fields_dict.alternative_items.grid.get_selected_children()
            }
          });
          dialog.hide();
        },
        primary_action_label: __("Continue")
      });
      dialog.fields_dict.info.$wrapper.html(
        `<p class="small text-muted">
				<span class="indicator yellow"></span>
				${__("Alternative Items")}
			</p>`
      );
      dialog.show();
    }
    set_dynamic_field_label() {
      let quotation_to = this.frm.doc.quotation_to;
      if (quotation_to === "Customer") {
        this.frm.set_df_property("party_name", "label", "Customer/Company Name");
        this.frm.set_df_property("party_name", "reqd", 1);
        this.frm.fields_dict.party_name.get_query = null;
      } else if (quotation_to === "Lead") {
        this.frm.set_df_property("party_name", "label", "Lead");
        this.frm.set_df_property("party_name", "reqd", 1);
        this.frm.fields_dict.party_name.get_query = () => {
          return { query: "erpnext.controllers.queries.lead_query" };
        };
      } else if (quotation_to === "Prospect") {
        this.frm.set_df_property("party_name", "label", "Prospect");
        this.frm.set_df_property("party_name", "reqd", 1);
        this.frm.fields_dict.party_name.get_query = null;
      }
    }
  };
  frappe.ui.form.on("Quotation", {
    onload(frm) {
      frm.script_manager.make(zsystem_customize.selling.QuotationController);
    },
    refresh(frm) {
      var _a, _b;
      if ((_b = (_a = frm.script_manager) == null ? void 0 : _a.frm) == null ? void 0 : _b.controller) {
        frm.script_manager.frm.controller.set_dynamic_field_label();
      }
    },
    quotation_to(frm) {
      var _a, _b;
      if ((_b = (_a = frm.script_manager) == null ? void 0 : _a.frm) == null ? void 0 : _b.controller) {
        frm.script_manager.frm.controller.set_dynamic_field_label();
      }
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/sales_order.js
  frappe.ui.form.on("Sales Order", {
    onload(frm) {
      frm.toggle_display("customer_name", false);
    },
    refresh(frm) {
      frm.toggle_display("customer_name", false);
    }
  });
})();
//# sourceMappingURL=zsystem_customize.bundle.TM4JQTQM.js.map
