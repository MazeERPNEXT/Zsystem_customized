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
        // 1) Move ID header after Description header
        let $header = $('.list-row-head');
        let $header_cols = $header.find('.list-row-col');

        let $id_header = null;
        let $desc_header = null;

        $header_cols.each(function () {
            let txt = $(this).text().trim();
            if (txt === "ID") $id_header = $(this);
            if (txt === "Description") $desc_header = $(this);
        });

        if ($id_header && $desc_header) {
            $id_header.insertAfter($desc_header);
        }

        // 2) Move each row's ID value after Description value
        $('.list-row-container .list-row').each(function () {
            let $row = $(this);
            let $cols = $row.find('.list-row-col');

            let $id_col = null;
            let $desc_col = null;

            $cols.each(function () {
                let $col = $(this);

                if ($col.find('span[title^="ID:"]').length) {
                    $id_col = $col;
                }

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

        // 3) Set "Status" header above the Enabled/Disabled column
        let $first_row = $('.list-row-container .list-row').first();
        let status_index = -1;

        $first_row.find('.list-row-col').each(function (i) {
            if ($(this).find('.indicator-pill').length) {
                status_index = i;
            }
        });

        if (status_index > -1) {
            let $status_header = $('.list-row-head .list-row-col').eq(status_index);
            let $span = $status_header.find('span').first();

            if ($span.length) {
                $span.text("Status");
            } else {
                $status_header.text("Status");
            }
            $status_header.show();
        }
    }, 500);
}