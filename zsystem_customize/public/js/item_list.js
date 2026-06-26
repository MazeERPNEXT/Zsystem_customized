frappe.listview_settings["Item"] = {
    onload(listview) {
        apply_item_list_customization();
    },

    refresh(listview) {
        apply_item_list_customization();
    }
};

function apply_item_list_customization() {
    setTimeout(() => {
        // -----------------------------
        // 1) Hide Status header + values
        // -----------------------------
        $('.list-row-col').each(function () {
            let txt = $(this).text().trim();

            if (txt === "Status") {
                $(this).hide();
            }

            if (
                $(this).find('.indicator-pill').length &&
                (txt === "Enabled" || txt === "Disabled")
            ) {
                $(this).hide();
            }
        });

        // -----------------------------------------
        // 2) Move ID header after Description header
        // -----------------------------------------
        let $header = $('.list-row-head');
        let $header_cols = $header.find('.list-row-col');

        let $id_header = null;
        let $desc_header = null;

        $header_cols.each(function () {
            let txt = $(this).text().trim();

            if (txt === "ID") {
                $id_header = $(this);
            }

            if (txt === "Description") {
                $desc_header = $(this);
            }
        });

        if ($id_header && $desc_header) {
            $id_header.insertAfter($desc_header);
        }

        // -------------------------------------------------
        // 3) Move each row's ID value after Description value
        // -------------------------------------------------
        $('.list-row-container .list-row').each(function () {
            let $row = $(this);
            let $cols = $row.find('.list-row-col');

            let $id_col = null;
            let $desc_col = null;

            $cols.each(function () {
                let $col = $(this);

                // ID value column
                if ($col.find('span[title^="ID:"]').length) {
                    $id_col = $col;
                }

                // Description value column = first normal text column
                if (
                    !$desc_col &&
                    !$col.find('span[title^="ID:"]').length &&
                    !$col.find('.indicator-pill').length &&
                    $col.text().trim() !== "" &&
                    !$col.find('input[type="checkbox"]').length
                ) {
                    $desc_col = $col;
                }
            });

            if ($id_col && $desc_col) {
                $id_col.insertAfter($desc_col);
            }
        });
    }, 500);
}