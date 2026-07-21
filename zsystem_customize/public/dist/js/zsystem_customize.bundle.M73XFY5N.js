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
  frappe.ui.form.on("Item", {
    custom_warehouse(frm) {
      var _a;
      if (!frm.doc.custom_warehouse)
        return;
      if (!((_a = frm.doc.item_defaults) == null ? void 0 : _a.length)) {
        let row = frm.add_child("item_defaults");
        row.default_warehouse = frm.doc.custom_warehouse;
      } else {
        frm.doc.item_defaults.forEach((row) => {
          row.default_warehouse = frm.doc.custom_warehouse;
        });
      }
      frm.refresh_field("item_defaults");
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/quotation.js
  frappe.ui.form.on("Quotation", {
    refresh(frm) {
      frm.fields_dict.custom_created_by.$wrapper.find(".control-value").css("color", "black");
    },
    onload(frm) {
      if (!frm.doc.__islocal)
        return;
      set_sales_person_by_user(frm);
      set_fiscal_year_prefix(frm);
      if (frm.is_new() && !frm.doc.custom_created_by) {
        frappe.db.set_value("User", frappe.session.user, "full_name").then((r) => {
          frm.set_value("custom_created_by", r.message.full_name);
        });
      }
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
    },
    async party_name(frm) {
      if (!frm.doc.party_name) {
        frm.set_value("contact_person", "");
        frm.set_value("customer_address", "");
        return;
      }
      frm.set_query("contact_person", function() {
        return {
          query: "frappe.contacts.doctype.contact.contact.contact_query",
          filters: {
            link_doctype: "Customer",
            link_name: frm.doc.party_name
          }
        };
      });
      frm.set_query("customer_address", function() {
        return {
          query: "frappe.contacts.doctype.address.address.address_query",
          filters: {
            link_doctype: "Customer",
            link_name: frm.doc.party_name
          }
        };
      });
      frappe.call({
        method: "zsystem_customize.quotation.get_customer_contact_address",
        args: {
          customer: frm.doc.party_name
        },
        callback: function(r) {
          if (r.message) {
            if (r.message.contact) {
              frm.set_value(
                "contact_person",
                r.message.contact
              );
            }
            if (r.message.address) {
              frm.set_value(
                "customer_address",
                r.message.address
              );
            }
          }
        }
      });
      if (frm.doc.party_name) {
        let r = await frappe.db.get_value(
          "Customer",
          frm.doc.party_name,
          "custom_sales_person"
        );
        frm.set_value(
          "custom_sales_person",
          r.message.custom_sales_person || ""
        );
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
  frappe.ui.form.on("Quotation Item", {
    item_code(frm, cdt, cdn) {
      setTimeout(function() {
        frappe.model.set_value(cdt, cdn, "rate", 0);
        frappe.model.set_value(cdt, cdn, "price_list_rate", 0);
        frappe.model.set_value(cdt, cdn, "base_price_list_rate", 0);
      }, 500);
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/sales_order.js
  frappe.ui.form.on("Sales Order", {
    onload: function(frm) {
      if (!frm.doc.__islocal)
        return;
      set_sales_person_by_user2(frm);
      set_fiscal_year_prefix2(frm);
      set_custom_quotation_no(frm);
      if (frm.is_new() && !frm.doc.custom_created_by) {
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
      frm.fields_dict.custom_created_by.$wrapper.find(".control-value").css("color", "black");
      set_custom_quotation_no(frm);
      setTimeout(() => {
        if (frappe.session.user === "naveen.k@zsystem.in" || frappe.session.user === "kamali.r@zsystem.in" || frappe.session.user == "zproposal@zsystem.in") {
          $('.dropdown-item[data-label="Delivery%20Note"]').hide();
        } else {
          $('.dropdown-item[data-label="Delivery%20Note"]').text("Billing Request");
        }
      }, 500);
      render_cancel_amend_button(frm);
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
    },
    async customer(frm) {
      if (frm.doc.customer) {
        let r = await frappe.db.get_value("Customer", frm.doc.customer, "custom_sales_person");
        frm.set_value("custom_sales_person", r.message.custom_sales_person || "");
      }
      frm.fields_dict.customer.$wrapper.find(".customer-payment-indicator").remove();
      if (!frm.doc.customer)
        return;
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Sales Invoice",
          filters: {
            customer: frm.doc.customer,
            docstatus: 1
          },
          fields: ["grand_total", "outstanding_amount"],
          limit_page_length: 0
        },
        callback: function(r) {
          let total = 0;
          let outstanding = 0;
          (r.message || []).forEach(function(inv) {
            total += flt(inv.grand_total);
            outstanding += flt(inv.outstanding_amount);
          });
          if (!total)
            return;
          let paid_amount = total - outstanding;
          let paid_percentage = (total - outstanding) / total * 100;
          let color = "#28a745";
          let status = "Good Customer";
          if (paid_percentage < 20) {
            color = "#dc3545";
            status = "High Risk Customer";
          } else if (paid_percentage < 50) {
            color = "#fd7e14";
            status = "Average Customer";
          }
          frm.fields_dict.customer.$wrapper.append(`
                    <div class="customer-payment-indicator"
                        style="margin-top:6px;display:flex;align-items:center;gap:6px;">
                        <span style="
                            width:10px;
                            height:10px;
                            border-radius:50%;
                            background:${color};
                            display:inline-block;">
                        </span>
                        <span style="font-weight:600;color:${color};">
                            ${status} (${format_currency(paid_amount)}) (${paid_percentage.toFixed(1)}% Paid)
                        </span>
                    </div>
                `);
        }
      });
      frappe.db.get_list("Sales Invoice", {
        filters: {
          customer: frm.doc.customer,
          docstatus: 1,
          outstanding_amount: [">", 0]
        },
        fields: ["outstanding_amount"],
        limit: 0
      }).then((r) => {
        let outstanding = r.reduce((sum, d) => sum + flt(d.outstanding_amount), 0);
        if (outstanding > 0) {
          let d = new frappe.ui.Dialog({
            title: __("Outstanding Amount"),
            fields: [
              {
                fieldtype: "HTML",
                options: `
                                <div style="font-size:15px;">
                                    Customer has an outstanding amount of
                                    <b>${format_currency(outstanding)}</b>.<br><br>
                                    Do you want to continue?
                                </div>
                            `
              }
            ],
            primary_action_label: __("Continue"),
            primary_action() {
              d.hide();
              frm.__stop_save = false;
            },
            secondary_action_label: __("Cancel"),
            secondary_action() {
              d.hide();
              frm.__stop_save = true;
              frm.set_value("customer", "");
            }
          });
          d.show();
        }
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
      setTimeout(function() {
        frappe.model.set_value(cdt, cdn, "rate", 0);
        frappe.model.set_value(cdt, cdn, "price_list_rate", 0);
        frappe.model.set_value(cdt, cdn, "base_price_list_rate", 0);
      }, 1e3);
      get_stock_qty_item(cdt, cdn);
    }
  });
  function get_stock_qty_item(cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code)
      return;
    frappe.db.get_value("Item", row.item_code, "custom_stock_qty").then((r) => {
      if (r.message) {
        frappe.model.set_value(
          cdt,
          cdn,
          "custom_item_stock_qty",
          r.message.custom_stock_qty || 0
        );
      }
    });
  }
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
  function render_cancel_amend_button(frm) {
    const $page_actions = frm.page.wrapper.find(".page-actions");
    if (frm.doc.docstatus !== 1) {
      $page_actions.find("#custom-cancel-amend-btn").remove();
      return;
    }
    frm.page.btn_secondary && frm.page.btn_secondary.hide();
    clearTimeout(frm._cancel_amend_timeout);
    frm._cancel_amend_timeout = setTimeout(() => {
      $page_actions.find("#custom-cancel-amend-btn").remove();
      const $btn = $(
        `<button id="custom-cancel-amend-btn" class="btn btn-secondary btn-sm" style="margin-left:8px;">${__("Cancel & Amend")}</button>`
      );
      $btn.on("click", () => cancel_and_amend(frm));
      $page_actions.append($btn);
    }, 200);
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

  // ../zsystem_customize/zsystem_customize/public/js/override_contactquickform.js
  frappe.provide("frappe.ui.form");
  var ZsystemGSTQuickEntryForm = class extends frappe.ui.form.CustomerQuickEntryForm {
    async setup() {
      await frappe.model.with_doctype("Address");
      await super.setup();
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
          label: __("Name"),
          fieldname: "map_to_first_name",
          fieldtype: "Data",
          reqd: 1
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
    get_address_fields() {
      let fields = super.get_address_fields();
      fields.forEach((field) => {
        const fieldname = field.fieldname === "_pincode" ? "pincode" : field.fieldname;
        if (fieldname && !field.label) {
          field.label = frappe.meta.get_label("Address", fieldname);
        }
      });
      return fields;
    }
    render_dialog() {
      super.render_dialog();
      const paymentField = this.dialog.get_field("custom_payment_term");
      if (paymentField) {
        paymentField.df.onchange = () => {
          const value = this.dialog.get_value("custom_payment_term");
          if (value && !/^\d+$/.test(value)) {
            frappe.msgprint(__("Payment Term must contain only numbers."));
            this.dialog.set_value(
              "custom_payment_term",
              value.replace(/\D/g, "")
            );
          }
        };
      }
      const customerNameField = this.dialog.get_field("customer_name");
      if (customerNameField) {
        customerNameField.df.onchange = () => {
          const value = this.dialog.get_value("customer_name");
          if (value) {
            this.dialog.set_value(
              "customer_name",
              value.toUpperCase()
            );
          }
        };
      }
      ["map_to_first_name", "_email_id", "_mobile_no"].forEach((fieldname) => {
        const field = this.dialog.get_field(fieldname);
        if (field) {
          field.df.reqd = 1;
          field.refresh();
        }
      });
      [
        "_pincode",
        "address_line1",
        "city",
        "state",
        "country"
      ].forEach((fieldname) => {
        const field = this.dialog.get_field(fieldname);
        if (field) {
          field.df.reqd = 1;
          field.refresh();
        }
      });
      if (this.doctype === "Customer") {
        const field = this.dialog.get_field("customer_pos_id");
        if (field) {
          field.df.hidden = 1;
          field.refresh();
        }
      }
    }
    update_doc() {
      const doc = super.update_doc();
      doc.email_id = doc._email_id || "";
      doc.mobile_no = doc._mobile_no || "";
      delete doc._email_id;
      delete doc._mobile_no;
      return doc;
    }
  };
  frappe.ui.form.CustomerQuickEntryForm = ZsystemGSTQuickEntryForm;
  var ZsystemGSTQuickEntryForms = class extends frappe.ui.form.SupplierQuickEntryForm {
    async setup() {
      await frappe.model.with_doctype("Address");
      await super.setup();
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
          label: __("Name"),
          fieldname: "map_to_first_name",
          fieldtype: "Data",
          reqd: 1
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
    get_address_fields() {
      let fields = super.get_address_fields();
      fields.forEach((field) => {
        const fieldname = field.fieldname === "_pincode" ? "pincode" : field.fieldname;
        if (fieldname && !field.label) {
          field.label = frappe.meta.get_label("Address", fieldname);
        }
      });
      return fields;
    }
    render_dialog() {
      super.render_dialog();
      const paymentField = this.dialog.get_field("custom_payment_term");
      if (paymentField) {
        paymentField.df.onchange = () => {
          const value = this.dialog.get_value("custom_payment_term");
          if (value && !/^\d+$/.test(value)) {
            frappe.msgprint(__("Payment Term must contain only numbers."));
            this.dialog.set_value(
              "custom_payment_term",
              value.replace(/\D/g, "")
            );
          }
        };
      }
      ["map_to_first_name", "_email_id", "_mobile_no"].forEach((fieldname) => {
        const field = this.dialog.get_field(fieldname);
        if (field) {
          field.df.reqd = 1;
          field.refresh();
        }
      });
      [
        "_pincode",
        "address_line1",
        "city",
        "state",
        "country"
      ].forEach((fieldname) => {
        const field = this.dialog.get_field(fieldname);
        if (field) {
          field.df.reqd = 1;
          field.refresh();
        }
      });
      if (this.doctype === "Customer") {
        const field = this.dialog.get_field("customer_pos_id");
        if (field) {
          field.df.hidden = 1;
          field.refresh();
        }
      }
    }
    update_doc() {
      const doc = super.update_doc();
      doc.email_id = doc._email_id || "";
      doc.mobile_no = doc._mobile_no || "";
      delete doc._email_id;
      delete doc._mobile_no;
      return doc;
    }
  };
  frappe.ui.form.SupplierQuickEntryForm = ZsystemGSTQuickEntryForms;

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
    },
    onload: function(frm) {
      if (frm.is_new() && frm.doc.custom_created_by) {
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
    refresh: function(frm) {
      frm.fields_dict.custom_created_by.$wrapper.find(".control-value").css("color", "black");
    },
    async customer(frm) {
      if (frm.doc.customer) {
        let r = await frappe.db.get_value("Customer", frm.doc.customer, "custom_sales_person");
        frm.set_value("custom_sales_person", r.message.custom_sales_person || "");
      }
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
      setTimeout(function() {
        frappe.model.set_value(cdt, cdn, "rate", 0);
      }, 1e3);
      set_filter_serialno_based_item(frm);
    }
  });
  frappe.ui.form.on("Delivery Note", {
    refresh(frm) {
      frm.fields_dict.custom_modified_by.$wrapper.find(".control-value").css("color", "black");
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
    before_submit: async function(frm) {
      for (let row of frm.doc.items || []) {
        if (row.item_code) {
          let r = await frappe.db.get_value(
            "Item",
            row.item_code,
            "custom_stock_qty"
          );
          if (r && r.message) {
            row.custom_item_stock_qty = r.message.custom_stock_qty || 0;
          }
        }
      }
      frm.refresh_field("items");
    },
    custom_priority(frm) {
      const map = {
        "High": 1,
        "Medium": 2,
        "Low": 3
      };
      frm.set_value("custom_priority_order", map[frm.doc.custom_priority] || 99);
    },
    async before_save(frm) {
      var _a;
      if (frm.doc.modified_by) {
        let r = await frappe.db.get_value("User", frm.doc.modified_by, "full_name");
        frm.set_value("custom_modified_by", ((_a = r.message) == null ? void 0 : _a.full_name) || "");
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
    },
    async customer(frm) {
      if (frm.doc.customer) {
        let r = await frappe.db.get_value("Customer", frm.doc.customer, "custom_sales_person");
        frm.set_value("custom_sales_person", r.message.custom_sales_person || "");
      }
    }
  });
  function set_filter_serialno_based_item(frm) {
    frm.set_query("custom_serial_data", "items", function(doc, cdt, cdn) {
      let row = locals[cdt][cdn];
      return {
        filters: {
          item_code: row.item_code,
          status: "Active"
        }
      };
    });
  }

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

  // ../zsystem_customize/zsystem_customize/public/js/customer.js
  frappe.ui.form.on("Customer", {
    customer_name(frm) {
      if (frm.doc.customer_name) {
        frm.set_value(
          "customer_name",
          frm.doc.customer_name.toUpperCase()
        );
      }
    },
    custom_payment_term(frm) {
      let payment_value = frm.doc.custom_payment_term;
      if (payment_value && !/^\d+$/.test(payment_value)) {
        frappe.msgprint(__("Payment Team allow number only"));
        frm.set_value("custom_payment_term", "");
      }
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/supplier.js
  frappe.ui.form.on("Supplier", {
    custom_payment_term(frm) {
      let payment_value = frm.doc.custom_payment_term;
      if (payment_value && !/^\d+$/.test(payment_value)) {
        frappe.msgprint(__("Payment Team allow number only"));
        frm.set_value("custom_payment_term", "");
      }
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/purchase_order.js
  frappe.ui.form.on("Purchase Order", {
    supplier(frm) {
      if (!frm.doc.supplier) {
        return;
      }
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          "doctype": "Purchase Order",
          filters: {
            supplier: frm.doc.supplier,
            docstatus: ["!=", 2]
          },
          fields: ["name", "shipping_address"],
          order_by: "creation desc",
          limit_page_length: 1
        },
        callback: function(r) {
          if (r.message && r.message.length) {
            let po = r.message[0];
            if (po.shipping_address) {
              frm.set_value("shipping_address", po.shipping_address);
            }
          }
        }
      });
    },
    before_submit: function(frm) {
      return new Promise((resolve, reject) => {
        frappe.call({
          method: "zsystem_customize.purchase_order.validate_stock_against_qty",
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
                },
                {
                  fieldtype: "Check",
                  fieldname: "confirm_submit",
                  label: "I have reviewed the stock warning and want to continue.",
                  onchange: function() {
                    let checked = d.get_value("confirm_submit");
                    if (checked) {
                      d.get_primary_btn().show();
                    } else {
                      d.get_primary_btn().hide();
                    }
                  }
                }
              ],
              primary_action_label: "Submit",
              primary_action() {
                d.hide();
                resolve();
              }
            });
            d.show();
            d.get_primary_btn().hide();
          }
        });
      });
    }
  });
  frappe.ui.form.on("Purchase Order Item", {
    item_code(frm, cdt, cdn) {
      let row = locals[cdt][cdn];
      if (!row.item_code)
        return;
      frappe.call({
        method: "zsystem_customize.purchase_order.get_last_purchase_detail",
        args: {
          item_code: row.item_code,
          supplier: frm.doc.supplier
        },
        callback(r) {
          if (r.message) {
            frappe.model.set_value(
              cdt,
              cdn,
              "last_purchase_price",
              r.message.rate
            );
            frappe.model.set_value(
              cdt,
              cdn,
              "custom_last_purchase_date",
              r.message.transaction_date
            );
          }
        }
      });
    }
  });

  // ../zsystem_customize/zsystem_customize/public/js/override_so.js
  frappe.provide("zsystem_customize");
  frappe.provide("zsystem_customize.selling");
  zsystem_customize.selling.SalesOrderController = class CustomSalesOrderController extends erpnext.selling.SellingController {
    setup(doc) {
      this.setup_accounting_dimension_triggers();
      super.setup(doc);
    }
    onload(doc, dt, dn) {
      super.onload(doc, dt, dn);
    }
    refresh(doc, dt, dn) {
      var me = this;
      super.refresh();
      let allow_delivery = false;
      if (doc.docstatus == 1) {
        if (this.frm.has_perm("submit")) {
          if (doc.status === "On Hold") {
            this.frm.add_custom_button(
              __("Resume"),
              function() {
                me.frm.cscript.update_status("Resume", "Draft");
              },
              __("Status")
            );
            if (flt(doc.per_delivered) < 100 || flt(doc.per_billed) < 100) {
              this.frm.add_custom_button(__("Close"), () => this.close_sales_order(), __("Status"));
            }
          } else if (doc.status === "Closed") {
            this.frm.add_custom_button(
              __("Re-open"),
              function() {
                me.frm.cscript.update_status("Re-open", "Draft");
              },
              __("Status")
            );
          }
        }
        if (doc.status !== "Closed") {
          if (doc.status !== "On Hold") {
            const items_are_deliverable = this.frm.doc.items.some(
              (item) => item.delivered_by_supplier === 0 && item.qty > flt(item.delivered_qty)
            );
            allow_delivery = (this.frm.doc.has_unit_price_items || items_are_deliverable) && !this.frm.doc.skip_delivery_note;
            if (this.frm.has_perm("submit")) {
              if (flt(doc.per_delivered) < 100 || flt(doc.per_billed) < 100) {
                this.frm.add_custom_button(
                  __("Hold"),
                  () => this.hold_sales_order(),
                  __("Status")
                );
                this.frm.add_custom_button(
                  __("Close"),
                  () => this.close_sales_order(),
                  __("Status")
                );
              }
            }
            if ((!doc.__onload || !doc.__onload.has_reserved_stock) && flt(doc.per_picked) < 100 && flt(doc.per_delivered) < 100 && frappe.model.can_create("Pick List")) {
              this.frm.add_custom_button(
                __("Pick List"),
                () => this.create_pick_list(),
                __("Create")
              );
            }
            const order_is_a_sale = ["Sales", "Shopping Cart"].indexOf(doc.order_type) !== -1;
            const order_is_maintenance = ["Maintenance"].indexOf(doc.order_type) !== -1;
            const order_is_a_custom_sale = ["Sales", "Shopping Cart", "Maintenance"].indexOf(doc.order_type) === -1;
            if (flt(doc.per_delivered) < 100 && (order_is_a_sale || order_is_a_custom_sale) && allow_delivery) {
              if (frappe.model.can_create("Delivery Note")) {
                this.frm.add_custom_button(
                  __("Delivery Note"),
                  () => this.make_delivery_note_based_on_delivery_date(true),
                  __("Create")
                );
              }
              if (frappe.model.can_create("Work Order")) {
                this.frm.add_custom_button(
                  __("Work Order"),
                  () => this.make_work_order(),
                  __("Create")
                );
              }
            }
            if (flt(doc.per_billed) < 100 && frappe.model.can_create("Sales Invoice")) {
              this.frm.add_custom_button(
                __("Sales Invoice"),
                () => me.make_sales_invoice(),
                __("Create")
              );
            }
            if ((!doc.order_type || (order_is_a_sale || order_is_a_custom_sale) && flt(doc.per_delivered) < 100) && frappe.model.can_create("Material Request")) {
              this.frm.add_custom_button(
                __("Material Request"),
                () => this.make_material_request(),
                __("Create")
              );
              this.frm.add_custom_button(
                __("Request for Raw Materials"),
                () => this.make_raw_material_request(),
                __("Create")
              );
            }
            if (!this.frm.doc.is_internal_customer && frappe.model.can_create("Purchase Order")) {
              this.frm.add_custom_button(
                __("Purchase Order"),
                () => this.make_purchase_order(),
                __("Create")
              );
            }
            if (flt(doc.per_delivered) < 100 && (order_is_maintenance || order_is_a_custom_sale)) {
              if (frappe.model.can_create("Maintenance Visit")) {
                this.frm.add_custom_button(
                  __("Maintenance Visit"),
                  () => this.make_maintenance_visit(),
                  __("Create")
                );
              }
              if (frappe.model.can_create("Maintenance Schedule")) {
                this.frm.add_custom_button(
                  __("Maintenance Schedule"),
                  () => this.make_maintenance_schedule(),
                  __("Create")
                );
              }
            }
            if (flt(doc.per_delivered) < 100 && frappe.model.can_create("Project")) {
              this.frm.add_custom_button(__("Project"), () => this.make_project(), __("Create"));
            }
            if (doc.docstatus === 1 && !doc.inter_company_order_reference && frappe.model.can_create("Purchase Order")) {
              let me2 = this;
              let internal = me2.frm.doc.is_internal_customer;
              if (internal) {
                let button_label = me2.frm.doc.company === me2.frm.doc.represents_company ? __("Internal Purchase Order") : __("Inter Company Purchase Order");
                me2.frm.add_custom_button(
                  button_label,
                  function() {
                    me2.make_inter_company_order();
                  },
                  __("Create")
                );
              }
            }
          }
          if (flt(doc.per_billed) < 100 + frappe.boot.sysdefaults.over_billing_allowance) {
            if (frappe.boot.user.in_create.includes("Payment Request")) {
              this.frm.add_custom_button(
                __("Payment Request"),
                () => this.make_payment_request(),
                __("Create")
              );
            }
            if (frappe.model.can_create("Payment Entry")) {
              this.frm.add_custom_button(
                __("Payment"),
                () => this.make_payment_entry(),
                __("Create")
              );
            }
          }
          this.frm.page.set_inner_btn_group_as_primary(__("Create"));
        }
      }
      if (this.frm.doc.docstatus === 0 && frappe.model.can_read("Quotation")) {
        this.frm.add_custom_button(
          __("Quotation"),
          function() {
            let d = erpnext.utils.map_current_doc({
              method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
              source_doctype: "Quotation",
              target: me.frm,
              setters: [
                {
                  label: __("Customer"),
                  fieldname: "party_name",
                  fieldtype: "Link",
                  options: "Customer",
                  default: me.frm.doc.customer || void 0
                }
              ],
              get_query_filters: {
                company: me.frm.doc.company,
                docstatus: 1,
                status: ["!=", "Lost"]
              },
              allow_child_item_selection: true,
              child_fieldname: "items",
              child_columns: ["item_code", "item_name", "qty", "rate", "amount"]
            });
            setTimeout(() => {
              d.$parent.append(`
							<span class='small text-muted'>
								${__("Note: Please create Sales Orders from individual Quotations to select from among Alternative Items.")}
							</span>
					`);
            }, 200);
          },
          __("Get Items From")
        );
      }
      this.order_type(doc);
    }
    items_add(doc, cdt, cdn) {
      const row = frappe.get_doc(cdt, cdn);
      const field_copy = [];
      if (doc.project) {
        frappe.model.set_value(cdt, cdn, "project", doc.project);
      } else {
        field_copy.push("project");
      }
      if (doc.delivery_date) {
        frappe.model.set_value(cdt, cdn, "delivery_date", doc.delivery_date);
      } else {
        field_copy.push("delivery_date");
      }
      if (field_copy.length) {
        this.frm.script_manager.copy_from_first_row("items", row, field_copy);
      }
    }
    create_pick_list() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.create_pick_list",
        frm: this.frm
      });
    }
    make_work_order() {
      var me = this;
      me.frm.call({
        method: "erpnext.selling.doctype.sales_order.sales_order.get_work_order_items",
        args: {
          sales_order: this.frm.docname
        },
        freeze: true,
        callback: function(r) {
          if (!r.message) {
            frappe.msgprint({
              title: __("Work Order not created"),
              message: __("No Items with Bill of Materials to Manufacture"),
              indicator: "orange"
            });
            return;
          } else {
            const fields = [
              {
                label: __("Items"),
                fieldtype: "Table",
                fieldname: "items",
                description: __("Select BOM and Qty for Production"),
                fields: [
                  {
                    fieldtype: "Read Only",
                    fieldname: "item_code",
                    label: __("Item Code"),
                    in_list_view: 1
                  },
                  {
                    fieldtype: "Link",
                    fieldname: "bom",
                    options: "BOM",
                    reqd: 1,
                    label: __("Select BOM"),
                    in_list_view: 1,
                    get_query: function(doc) {
                      return { filters: { item: doc.item_code } };
                    }
                  },
                  {
                    fieldtype: "Float",
                    fieldname: "pending_qty",
                    reqd: 1,
                    label: __("Qty"),
                    in_list_view: 1
                  },
                  {
                    fieldtype: "Data",
                    fieldname: "sales_order_item",
                    reqd: 1,
                    label: __("Sales Order Item"),
                    hidden: 1
                  }
                ],
                data: r.message,
                get_data: () => {
                  return r.message;
                }
              }
            ];
            var d = new frappe.ui.Dialog({
              title: __("Select Items to Manufacture"),
              fields,
              primary_action: function() {
                var data = { items: d.fields_dict.items.grid.get_selected_children() };
                if (!data.items.length) {
                  frappe.throw(__("Please select atleast one item to continue"));
                }
                me.frm.call({
                  method: "make_work_orders",
                  args: {
                    items: data,
                    company: me.frm.doc.company,
                    sales_order: me.frm.docname,
                    project: me.frm.project
                  },
                  freeze: true,
                  callback: function(r2) {
                    if (r2.message) {
                      frappe.msgprint({
                        message: __("Work Orders Created: {0}", [
                          r2.message.map(function(d2) {
                            return repl(
                              '<a href="/app/work-order/%(name)s">%(name)s</a>',
                              { name: d2 }
                            );
                          }).join(", ")
                        ]),
                        indicator: "green"
                      });
                    }
                    d.hide();
                  }
                });
              },
              primary_action_label: __("Create")
            });
            d.show();
          }
        }
      });
    }
    order_type() {
      this.toggle_delivery_date();
    }
    tc_name() {
      this.get_terms();
    }
    make_material_request() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_material_request",
        frm: this.frm
      });
    }
    skip_delivery_note() {
      this.toggle_delivery_date();
    }
    toggle_delivery_date() {
      this.frm.fields_dict.items.grid.toggle_reqd(
        "delivery_date",
        this.frm.doc.order_type == "Sales" && !this.frm.doc.skip_delivery_note
      );
    }
    make_raw_material_request() {
      var me = this;
      this.frm.call({
        method: "erpnext.selling.doctype.sales_order.sales_order.get_work_order_items",
        args: {
          sales_order: this.frm.docname,
          for_raw_material_request: 1
        },
        callback: function(r) {
          if (!r.message) {
            frappe.msgprint({
              message: __("No Items with Bill of Materials."),
              indicator: "orange"
            });
            return;
          } else {
            me.make_raw_material_request_dialog(r);
          }
        }
      });
    }
    make_raw_material_request_dialog(r) {
      var me = this;
      var fields = [
        { fieldtype: "Check", fieldname: "include_exploded_items", label: __("Include Exploded Items") },
        {
          fieldtype: "Check",
          fieldname: "ignore_existing_ordered_qty",
          label: __("Ignore Existing Ordered Qty")
        },
        {
          fieldtype: "Table",
          fieldname: "items",
          description: __("Select BOM, Qty and For Warehouse"),
          fields: [
            {
              fieldtype: "Read Only",
              fieldname: "item_code",
              label: __("Item Code"),
              in_list_view: 1
            },
            {
              fieldtype: "Link",
              fieldname: "warehouse",
              options: "Warehouse",
              label: __("For Warehouse"),
              in_list_view: 1
            },
            {
              fieldtype: "Link",
              fieldname: "bom",
              options: "BOM",
              reqd: 1,
              label: __("BOM"),
              in_list_view: 1,
              get_query: function(doc) {
                return { filters: { item: doc.item_code } };
              }
            },
            {
              fieldtype: "Float",
              fieldname: "required_qty",
              reqd: 1,
              label: __("Qty"),
              in_list_view: 1
            }
          ],
          data: r.message,
          get_data: function() {
            return r.message;
          }
        }
      ];
      var d = new frappe.ui.Dialog({
        title: __("Items for Raw Material Request"),
        fields,
        primary_action: function() {
          var data = d.get_values();
          me.frm.call({
            method: "erpnext.selling.doctype.sales_order.sales_order.make_raw_material_request",
            args: {
              items: data,
              company: me.frm.doc.company,
              sales_order: me.frm.docname,
              project: me.frm.doc.project
            },
            freeze: true,
            callback: function(r2) {
              if (r2.message) {
                frappe.msgprint(
                  __("Material Request {0} submitted.", [
                    '<a href="/app/material-request/' + r2.message.name + '">' + r2.message.name + "</a>"
                  ])
                );
              }
              d.hide();
              me.frm.reload_doc();
            }
          });
        },
        primary_action_label: __("Create")
      });
      d.show();
    }
    make_delivery_note_based_on_delivery_date(for_reserved_stock = false) {
      var me = this;
      var delivery_dates = this.frm.doc.items.map((i) => i.delivery_date);
      delivery_dates = [...new Set(delivery_dates)];
      var item_grid = this.frm.fields_dict["items"].grid;
      if (!item_grid.get_selected().length && delivery_dates.length > 1) {
        var dialog = new frappe.ui.Dialog({
          title: __("Select Items based on Delivery Date"),
          fields: [{ fieldtype: "HTML", fieldname: "dates_html" }]
        });
        var html = $(`
				<div style="border: 1px solid #d1d8dd">
					<div class="list-item list-item--head">
						<div class="list-item__content list-item__content--flex-2">
							${__("Delivery Date")}
						</div>
					</div>
					${delivery_dates.map(
          (date) => `
						<div class="list-item">
							<div class="list-item__content list-item__content--flex-2">
								<label>
								<input type="checkbox" data-date="${date}" checked="checked"/>
								${frappe.datetime.str_to_user(date)}
								</label>
							</div>
						</div>
					`
        ).join("")}
				</div>
			`);
        var wrapper = dialog.fields_dict.dates_html.$wrapper;
        wrapper.html(html);
        dialog.set_primary_action(__("Select"), function() {
          var dates = wrapper.find("input[type=checkbox]:checked").map((i, el) => $(el).attr("data-date")).toArray();
          if (!dates)
            return;
          me.make_delivery_note(dates, for_reserved_stock);
          dialog.hide();
        });
        dialog.show();
      } else {
        this.make_delivery_note([], for_reserved_stock);
      }
    }
    make_delivery_note(delivery_dates, for_reserved_stock = false) {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_delivery_note",
        frm: this.frm,
        args: {
          delivery_dates,
          for_reserved_stock
        },
        freeze: true,
        freeze_message: __("Creating Delivery Note ...")
      });
    }
    make_sales_invoice() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
        frm: this.frm
      });
    }
    make_maintenance_schedule() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_schedule",
        frm: this.frm
      });
    }
    make_project() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_project",
        frm: this.frm
      });
    }
    make_inter_company_order() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_inter_company_purchase_order",
        frm: this.frm
      });
    }
    make_maintenance_visit() {
      frappe.model.open_mapped_doc({
        method: "erpnext.selling.doctype.sales_order.sales_order.make_maintenance_visit",
        frm: this.frm
      });
    }
    make_purchase_order() {
      let pending_items = this.frm.doc.items.some((item) => {
        const pending_qty = flt(item.stock_qty) - this.get_ordered_qty(item, this.frm.doc);
        return pending_qty > 0;
      });
      if (!pending_items) {
        frappe.throw({
          message: __("Purchase Order already created for all Sales Order items"),
          title: __("Note")
        });
      }
      var me = this;
      var dialog = new frappe.ui.Dialog({
        title: __("Select Items"),
        size: "large",
        fields: [
          {
            fieldtype: "Check",
            label: __("Against Default Supplier"),
            fieldname: "against_default_supplier",
            default: 0
          },
          {
            fieldname: "items_for_po",
            fieldtype: "Table",
            label: __("Select Items"),
            fields: [
              {
                fieldtype: "Data",
                fieldname: "item_code",
                label: __("Item"),
                read_only: 1,
                in_list_view: 1
              },
              {
                fieldtype: "Data",
                fieldname: "item_name",
                label: __("Item name"),
                read_only: 1,
                in_list_view: 1
              },
              {
                fieldtype: "Float",
                fieldname: "pending_qty",
                label: __("Pending Qty"),
                read_only: 1,
                in_list_view: 1
              },
              {
                fieldtype: "Link",
                read_only: 1,
                fieldname: "uom",
                label: __("UOM"),
                options: "UOM",
                in_list_view: 1
              },
              {
                fieldtype: "Data",
                fieldname: "supplier",
                label: __("Supplier"),
                read_only: 1,
                in_list_view: 1
              },
              {
                fieldtype: "Float",
                fieldname: "custom_stock_qty",
                label: __("Custom Stock Qty"),
                read_only: 1,
                in_list_view: 1
              },
              {
                fieldtype: "Check",
                fieldname: "is_low_stock",
                label: __("Low Stock"),
                read_only: 1,
                in_list_view: 1
              }
            ]
          },
          {
            fieldtype: "Check",
            fieldname: "confirm_low_stock",
            label: __("I confirm creation of Purchase Order despite Already stock qty"),
            default: 0,
            hidden: 1
          }
        ],
        primary_action_label: __("Create Purchase Order"),
        primary_action(args) {
          if (!args)
            return;
          let selected_items = dialog.fields_dict.items_for_po.grid.get_selected_children();
          if (selected_items.length == 0) {
            frappe.throw({
              message: "Please select Items from the Table",
              title: __("Items Required"),
              indicator: "blue"
            });
          }
          let has_low_stock = selected_items.some((item) => item.is_low_stock);
          if (has_low_stock && !args.confirm_low_stock) {
            dialog.get_field("confirm_low_stock").df.hidden = 0;
            dialog.get_field("confirm_low_stock").refresh();
            frappe.msgprint({
              title: __("Already Stock"),
              message: __(
                "One or more selected items have Pending Qty have Already Stock Qty. Please confirm below to proceed."
              ),
              indicator: "orange"
            });
            return;
          }
          dialog.hide();
          var method = args.against_default_supplier ? "make_purchase_order_for_default_supplier" : "make_purchase_order";
          return frappe.call({
            method: "erpnext.selling.doctype.sales_order.sales_order." + method,
            freeze_message: __("Creating Purchase Order ..."),
            args: {
              source_name: me.frm.doc.name,
              selected_items
            },
            freeze: true,
            callback: function(r) {
              if (!r.exc) {
                if (!args.against_default_supplier) {
                  frappe.model.sync(r.message);
                  frappe.set_route("Form", r.message.doctype, r.message.name);
                } else {
                  frappe.route_options = {
                    sales_order: me.frm.doc.name
                  };
                  frappe.set_route("List", "Purchase Order");
                }
              }
            }
          });
        }
      });
      dialog.fields_dict["against_default_supplier"].df.onchange = () => set_po_items_data(dialog);
      async function set_po_items_data(dialog2) {
        var against_default_supplier = dialog2.get_value("against_default_supplier");
        var items_for_po = dialog2.get_value("items_for_po");
        if (against_default_supplier) {
          let items_with_supplier = items_for_po.filter((item) => item.supplier);
          dialog2.fields_dict["items_for_po"].df.data = items_with_supplier;
          dialog2.get_field("items_for_po").refresh();
        } else {
          let po_items = [];
          dialog2.set_value("confirm_low_stock", 0);
          dialog2.get_field("confirm_low_stock").df.hidden = 1;
          dialog2.get_field("confirm_low_stock").refresh();
          for (const d of me.frm.doc.items) {
            let ordered_qty = me.get_ordered_qty(d, me.frm.doc);
            let pending_qty = (flt(d.stock_qty) - ordered_qty) / flt(d.conversion_factor);
            if (pending_qty > 0) {
              let custom_stock_qty = 0;
              try {
                const res = await frappe.db.get_value("Item", d.item_code, "custom_stock_qty");
                custom_stock_qty = flt(res && res.message && res.message.custom_stock_qty);
              } catch (e) {
                custom_stock_qty = 0;
              }
              po_items.push({
                name: d.name,
                item_name: d.item_name,
                item_code: d.item_code,
                pending_qty,
                uom: d.uom,
                supplier: d.supplier,
                custom_stock_qty,
                is_low_stock: flt(pending_qty) < custom_stock_qty
              });
            }
          }
          dialog2.fields_dict["items_for_po"].df.data = po_items;
          dialog2.get_field("items_for_po").refresh();
        }
      }
      set_po_items_data(dialog);
      dialog.get_field("items_for_po").grid.only_sortable();
      dialog.get_field("items_for_po").refresh();
      dialog.wrapper.find(".grid-heading-row .grid-row-check").click();
      dialog.show();
    }
    get_ordered_qty(item, so) {
      let ordered_qty = item.ordered_qty;
      if (so.packed_items && so.packed_items.length) {
        let packed_items = so.packed_items.filter((pi) => pi.parent_detail_docname == item.name);
        if (packed_items && packed_items.length) {
          const all_packed_items_ordered = packed_items.every(
            (pi) => flt(pi.ordered_qty) >= flt(pi.qty)
          );
          ordered_qty = all_packed_items_ordered ? item.stock_qty : 0;
        }
      }
      return ordered_qty;
    }
    hold_sales_order() {
      var me = this;
      var d = new frappe.ui.Dialog({
        title: __("Reason for Hold"),
        fields: [
          {
            fieldname: "reason_for_hold",
            fieldtype: "Text",
            reqd: 1
          }
        ],
        primary_action: function() {
          var data = d.get_values();
          frappe.call({
            method: "frappe.desk.form.utils.add_comment",
            args: {
              reference_doctype: me.frm.doctype,
              reference_name: me.frm.docname,
              content: __("Reason for hold:") + " " + data.reason_for_hold,
              comment_email: frappe.session.user,
              comment_by: frappe.session.user_fullname
            },
            callback: function(r) {
              if (!r.exc) {
                me.update_status("Hold", "On Hold");
                d.hide();
              }
            }
          });
        }
      });
      d.show();
    }
    close_sales_order() {
      this.frm.cscript.update_status("Close", "Closed");
    }
    update_status(label, status) {
      var doc = this.frm.doc;
      var me = this;
      frappe.ui.form.is_saving = true;
      frappe.call({
        method: "erpnext.selling.doctype.sales_order.sales_order.update_status",
        args: { status, name: doc.name },
        callback: function(r) {
          me.frm.reload_doc();
        },
        always: function() {
          frappe.ui.form.is_saving = false;
        }
      });
    }
  };
  frappe.ui.form.on("Sales Order", {
    onload(frm) {
      extend_cscript(frm.cscript, new zsystem_customize.selling.SalesOrderController({ frm }));
    }
  });
})();
//# sourceMappingURL=zsystem_customize.bundle.M73XFY5N.js.map
