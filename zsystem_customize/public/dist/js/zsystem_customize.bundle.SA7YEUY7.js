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
  frappe.ui.form.on("Quotation", {
    onload(frm) {
      if (!frm.doc.__islocal)
        return;
      set_sales_person_by_user(frm);
      set_fiscal_year_prefix(frm);
    },
    custom_sales_person(frm) {
      if (frm.doc.__islocal) {
        set_naming_series(frm);
      }
    },
    custom_offer_type(frm) {
      if (frm.doc.__islocal) {
        set_naming_series(frm);
      }
    },
    validate(frm) {
      if (frm.doc.__islocal) {
        set_naming_series(frm);
      }
    }
  });
  function set_sales_person_by_user(frm) {
    if (!frm.doc.__islocal)
      return;
    const user_map = {
      "Rajarajan": "Rajarajan",
      "Rajarajan.M": "Rajarajan",
      "chandru": "Chandru",
      "Chandru.R": "Chandru",
      "Ramesh.P": "Ramesh"
    };
    const sp = user_map[frappe.session.user_fullname];
    if (!sp)
      return;
    const options = frm.fields_dict.custom_sales_person.df.options || "";
    if (options.includes(sp)) {
      frm.set_value("custom_sales_person", sp);
    } else {
      frappe.msgprint(`\u26A0\uFE0F '${sp}' not available in Sales Person options`);
    }
  }
  function set_fiscal_year_prefix(frm) {
    if (!frm.doc.__islocal || frm.fy_code)
      return;
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Fiscal Year",
        fields: ["name"],
        order_by: "year_start_date desc",
        limit_page_length: 1
      },
      callback(r) {
        if (!r.message || !r.message.length)
          return;
        let fy = r.message[0].name;
        let parts = fy.split("-");
        if (parts.length === 2) {
          frm.fy_code = parts[0].slice(-2) + parts[1].slice(-2);
          set_naming_series(frm);
        }
      }
    });
  }
  function set_naming_series(frm) {
    if (!frm.doc.__islocal)
      return;
    if (!frm.fy_code)
      return;
    const sp = frm.doc.custom_sales_person;
    const ot = frm.doc.custom_offer_type;
    if (!sp || !ot)
      return;
    const person_code = {
      "Chandru": "CR",
      "Rajarajan": "MR",
      "Ramesh": "RR"
    }[sp];
    const offer_code = {
      "Trade Siemens-TS": "TS",
      "Services Support-SS": "SS",
      "Trade Teltonika-TK": "TK",
      "Trade Truck-TT": "TT",
      "Trade Azbil-TA": "TA",
      "Trade Disoic-TD": "TD",
      "Project-PJ": "PJ",
      "Trade Others-TO": "TO"
    }[ot];
    if (!person_code || !offer_code)
      return;
    frm.set_value(
      "naming_series",
      `${frm.fy_code}-${offer_code}-${person_code}-.####`
    );
  }

  // ../zsystem_customize/zsystem_customize/public/js/sales_order.js
  frappe.ui.form.on("Sales Order", {
    onload: function(frm) {
      if (!frm.doc.__islocal)
        return;
      set_sales_person_by_user2(frm);
      set_fiscal_year_prefix2(frm);
      set_custom_quotation_no(frm);
      if (!frm.doc.custom_created_by) {
        frappe.db.get_value(
          "User",
          frappe.session.user,
          "full_name"
        ).then((r) => {
          if (r.message) {
            frm.set_value("custom_created_by", r.message.full_name);
          }
        });
      }
    },
    custom_sales_person(frm) {
      if (frm.doc.__islocal) {
        set_naming_series2(frm);
      }
    },
    custom_quotation_no(frm) {
      set_naming_series2(frm);
    },
    refresh: function(frm) {
      set_custom_quotation_no(frm);
      frm.custom_cancel_amend_added = false;
      frm.page.clear_actions_menu();
      $(".page-actions .btn:contains('Cancel & Amend')").remove();
      if (frm.doc.docstatus === 1) {
        frm.page.btn_secondary && frm.page.btn_secondary.hide();
        frm.add_custom_button(
          __("Cancel & Amend"),
          () => cancel_and_amend(frm)
        );
        frm.custom_cancel_amend_added = true;
        move_cancel_amend_after_menu();
      }
    },
    onload_post_render(frm) {
      var _a;
      if (frm.doc.__islocal && ((_a = frm.doc.items) == null ? void 0 : _a.length)) {
        frm.doc.items.forEach((row) => {
          fetch_last_sales_order_details(frm, row.doctype, row.name);
        });
      }
    },
    before_submit: function(frm) {
      return new Promise((resolve, reject) => {
        frappe.call({
          method: "zsystem_customize.sales_order.validate_so_stock",
          args: {
            doctype: frm.doctype,
            name: frm.doc.name
          },
          callback: function(r) {
            if (!r.message || !r.message.has_error) {
              resolve();
              return;
            }
            let d = new frappe.ui.Dialog({
              title: "Stock Warning",
              size: "large",
              fields: [
                {
                  fieldtype: "HTML",
                  fieldname: "stock_html",
                  options: r.message.html
                }
              ],
              primary_action_label: "Submit",
              primary_action() {
                d.hide();
                resolve();
              },
              secondary_action_label: "Hold",
              secondary_action() {
                d.hide();
                reject();
              }
            });
            d.show();
          }
        });
      });
    }
  });
  function set_custom_quotation_no(frm) {
    if (frm.doc.custom_quotation_no)
      return;
    if (frm.doc.items && frm.doc.items.length > 0) {
      let first_row = frm.doc.items[0];
      if (first_row.prevdoc_docname) {
        frm.set_value(
          "custom_quotation_no",
          first_row.prevdoc_docname
        );
      }
    }
  }
  function set_sales_person_by_user2(frm) {
    if (!frm.is_new())
      return;
    const user_map = {
      "Rajarajan": "Rajarajan",
      "Rajarajan.M": "Rajarajan",
      "chandru": "Chandru",
      "Chandru.R": "Chandru",
      "Ramesh.P": "Ramesh"
    };
    const sp = user_map[frappe.session.user_fullname];
    if (!sp)
      return;
    const options = frm.fields_dict.custom_sales_person.df.options || "";
    if (options.includes(sp)) {
      frm.set_value("custom_sales_person", sp);
    }
  }
  function set_fiscal_year_prefix2(frm) {
    if (!frm.is_new())
      return;
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Fiscal Year",
        fields: ["name"],
        order_by: "year_start_date desc",
        limit_page_length: 1
      },
      callback: function(r) {
        if (!r.message || !r.message.length)
          return;
        let fy = r.message[0].name;
        let parts = fy.split("-");
        if (parts.length === 2) {
          frm.fy_code = parts[0].slice(-2) + parts[1].slice(-2);
          set_naming_series2(frm);
        }
      }
    });
  }
  function set_naming_series2(frm) {
    if (!frm.is_new())
      return;
    if (!frm.fy_code)
      return;
    const sp = frm.doc.custom_sales_person;
    const quote_no = frm.doc.custom_quotation_no;
    if (!sp || !quote_no)
      return;
    const qn = quote_no.slice(-4);
    const person_code = {
      "Chandru": "CR",
      "Rajarajan": "MR",
      "Ramesh": "RR"
    }[sp];
    if (!person_code)
      return;
    const naming_series = `${frm.fy_code}-${person_code}-${qn}-.####`;
    frm.set_value("naming_series", naming_series);
  }
  frappe.ui.form.on("Sales Order Item", {
    item_code(frm, cdt, cdn) {
      fetch_last_sales_order_details(frm, cdt, cdn);
    }
  });
  function fetch_last_sales_order_details(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code || !frm.doc.customer)
      return;
    frappe.call({
      method: "zsystem_customize.sales_order.get_last_sales_order_details",
      args: {
        customer: frm.doc.customer,
        item_code: row.item_code,
        current_so: frm.doc.name || ""
      },
      callback(r) {
        if (r.message && r.message.rate) {
          frappe.model.set_value(cdt, cdn, {
            custom_last_selling_amount: r.message.rate,
            custom_last_selling_date: r.message.transaction_date
          });
        }
      }
    });
  }
  function cancel_and_amend(frm) {
    frappe.confirm(
      __("This will CANCEL the document and create an AMENDED copy with Revision (R1, R2...). Continue?"),
      () => {
        frappe.call({
          method: "frappe.client.cancel",
          args: {
            doctype: frm.doc.doctype,
            name: frm.doc.name
          },
          freeze: true
        }).then(() => {
          frappe.call({
            method: "zsystem_customize.sales_order.create_amended_with_revision",
            args: {
              sales_order: frm.doc.name
            },
            freeze: true
          }).then((r) => {
            if (r.message && r.message.name) {
              frappe.set_route("Form", "Sales Order", r.message.name);
            }
          });
        });
      }
    );
  }
  function move_cancel_amend_after_menu() {
    if (cur_frm.doc.docstatus !== 1)
      return;
    setTimeout(() => {
      const $menu = $(".page-actions .menu-btn-group");
      const $btn = $(".page-actions .btn:contains('Cancel & Amend')");
      if ($menu.length && $btn.length) {
        $btn.addClass("btn-secondary").css("margin-left", "8px").insertAfter($menu);
      }
    }, 200);
  }

  // ../zsystem_customize/zsystem_customize/public/js/override_contactquickform.js
  frappe.provide("frappe.ui.form");
  var ZsystemGSTQuickEntryForm = class extends frappe.ui.form.CustomerQuickEntryForm {
    get_address_fields() {
      const fields = super.get_address_fields();
      for (const field of fields) {
        const fieldname = field.fieldname === "_pincode" ? "pincode" : field.fieldname;
        if (!field.label && fieldname) {
          field.label = frappe.meta.get_label("Address", fieldname);
        }
      }
      return fields;
    }
    render_dialog() {
      this.mandatory = [
        ...this.mandatory
      ];
      if (this.doctype === "Customer") {
        this.mandatory.push({
          label: __("Customer POS ID"),
          fieldname: "customer_pos_id",
          fieldtype: "Data",
          hidden: 1
        });
      }
      super.render_dialog();
    }
    get_contact_fields() {
      return [
        {
          label: __("Primary Contact Details"),
          fieldname: "primary_contact_section",
          fieldtype: "Section Break",
          collapsible: 0
        },
        {
          label: __("Email ID"),
          fieldname: "_email_id",
          fieldtype: "Data",
          options: "Email",
          reqd: 1
        },
        {
          fieldtype: "Column Break"
        },
        {
          label: __("Mobile Number"),
          fieldname: "_mobile_no",
          fieldtype: "Data",
          reqd: 1
        }
      ];
    }
    update_doc() {
      const doc = super.update_doc();
      doc._address_line1 = doc.address_line1;
      delete doc.address_line1;
      doc.email_id = doc._email_id;
      doc.mobile_no = doc._mobile_no;
      return doc;
    }
  };
  frappe.ui.form.CustomerQuickEntryForm = ZsystemGSTQuickEntryForm;

  // ../zsystem_customize/zsystem_customize/public/js/override_quotation.js
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
    tc_name() {
      this.get_terms();
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

  // ../zsystem_customize/zsystem_customize/public/js/sale_invoice.js
  frappe.ui.form.on("Sales Invoice", {
    custom_income_account(frm) {
      if (!frm.doc.custom_income_account)
        return;
      frm.doc.items.forEach((row) => {
        frappe.model.set_value(
          row.doctype,
          row.name,
          "income_account",
          frm.doc.custom_income_account
        );
      });
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/purchase_invoice.js
  frappe.ui.form.on("Purchase Invoice", {
    custom_expense_head(frm) {
      if (!frm.doc.custom_expense_head)
        return;
      frm.doc.items.forEach((row) => {
        frappe.model.set_value(
          row.doctype,
          row.name,
          "expense_account",
          frm.doc.custom_expense_head
        );
      });
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/delivery_note.js
  frappe.ui.form.on("Delivery Note Item", {
    item_code: function(frm, cdt, cdn) {
      locals[cdt][cdn].use_serial_batch_fields = 1;
      frappe.flags.dialog_set = false;
      frappe.flags.hide_serial_batch_dialog = false;
    }
  });
  frappe.ui.form.on("Delivery Note", {
    refresh(frm) {
      if (frm.doc.docstatus === 1 && frm.doc.custom_returnable_dc == 1 && frm.doc.is_return == 1) {
        frm.page.set_indicator(
          __("Return DC"),
          "orange"
        );
      } else if (frm.doc.docstatus === 1 && frm.doc.custom_returnable_dc == 1 && frm.doc.status === "Return Issued") {
        frm.page.set_indicator(
          __("Return Issued"),
          "grey"
        );
      } else if (frm.doc.docstatus === 1 && frm.doc.custom_returnable_dc == 1 && flt(frm.doc.per_billed) >= 100) {
        frm.page.set_indicator(
          __("Completed"),
          "green"
        );
      } else if (frm.doc.docstatus === 1 && frm.doc.custom_returnable_dc == 1) {
        frm.page.set_indicator(
          __("Returnable DC"),
          "orange"
        );
      }
    },
    on_submit(frm) {
      if (frm.doc.custom_returnable_dc == 1 && frm.doc.is_return == 1) {
        frappe.db.set_value(
          "Delivery Note",
          frm.doc.name,
          "status",
          "Return DC"
        );
        if (frm.doc.return_against) {
          frappe.db.set_value(
            "Delivery Note",
            frm.doc.return_against,
            "status",
            "Return Issued"
          );
        }
        frm.reload_doc();
      } else if (frm.doc.custom_returnable_dc == 1) {
        frappe.db.set_value(
          "Delivery Note",
          frm.doc.name,
          "status",
          "Returnable DC"
        ).then(() => {
          frm.reload_doc();
        });
      }
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/so_status.js
  frappe.ui.form.on("Sales Order", {
    refresh(frm) {
      update_custom_status(frm);
    },
    per_delivered(frm) {
      update_custom_status(frm);
    }
  });
  function update_custom_status(frm) {
    if (frm.doc.docstatus === 1) {
      if (frm.doc.per_delivered < 100 && frm.doc.per_delivered > 0) {
        frm.page.set_indicator(
          __("Partially Deliver"),
          "orange"
        );
        frm.set_value("status", "Partially Deliver");
      }
    }
  }
})();
//# sourceMappingURL=zsystem_customize.bundle.SA7YEUY7.js.map
