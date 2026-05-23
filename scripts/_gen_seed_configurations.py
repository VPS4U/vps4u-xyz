# Generator INSERTs dla product_configurations z briefu

# Mapowanie combo -> (vcpu, ram, disk)
HW = {
    'base':   (2, 4, 80),
    'S':      (2, 8, 80),
    'D':      (2, 4, 160),
    'S+D':    (2, 8, 160),
    'L':      (4, 8, 80),
    'L+S':    (4, 16, 80),
    'L+D':    (4, 8, 160),
    'L+S+D':  (4, 16, 160),
}

# Per-line: transfer_tb, port_mbps, backup_included_from
LINE_META = {
    'gold':      (20, 1000, None),    # Hetzner CX
    'orange':    (32, 1000, None),    # Contabo
    'czarny':    (20, 1000, None),    # Hetzner CPX (backup płatny)
    'bialy':     (4, 1000, 'L'),      # Hostinger (backup wliczony od L)
    'czerwony':  (100, 1000, None),   # OVH Value (advanced anti-DDoS)
    'niebieski': (100, 1000, 'L'),    # OVH Comfort (backup wliczony od L)
}

# Brief sekcja 7 — ceny miesięczne €
# combo -> {line_sku: price_eur or None if niedostępne}
MONTHLY = {
    # combo_brief: (hardware, addons, prices_per_line)
    'base':    ('base', [], {'orange':18, 'bialy':20, 'czarny':20, 'niebieski':36, 'gold':15, 'czerwony':23}),
    'A':       ('base', ['A'], {'orange':None, 'bialy':20, 'czarny':20, 'niebieski':23, 'gold':None, 'czerwony':23}),
    'X':       ('base', ['X'], {'orange':19, 'bialy':22, 'czarny':18, 'niebieski':26, 'gold':16, 'czerwony':25}),
    'D':       ('D', [], {'orange':24, 'bialy':26, 'czarny':22, 'niebieski':31, 'gold':20, 'czerwony':31}),
    'S':       ('S', [], {'orange':23, 'bialy':26, 'czarny':22, 'niebieski':30, 'gold':18, 'czerwony':30}),
    'S+X':     ('S', ['X'], {'orange':25, 'bialy':28, 'czarny':23, 'niebieski':32, 'gold':20, 'czerwony':32}),
    'S+D':     ('S+D', [], {'orange':29, 'bialy':26, 'czarny':28, 'niebieski':38, 'gold':24, 'czerwony':32}),
    'L':       ('L', [], {'orange':25, 'bialy':30, 'czarny':26, 'niebieski':35, 'gold':26, 'czerwony':32}),
    'L+A':     ('L', ['A'], {'orange':None, 'bialy':30, 'czarny':26, 'niebieski':35, 'gold':None, 'czerwony':32}),
    'L+X':     ('L', ['X'], {'orange':27, 'bialy':33, 'czarny':28, 'niebieski':36, 'gold':28, 'czerwony':34}),
    'L+X+A':   ('L', ['X','A'], {'orange':None, 'bialy':33, 'czarny':28, 'niebieski':36, 'gold':None, 'czerwony':34}),
    'L+S':     ('L+S', [], {'orange':31, 'bialy':36, 'czarny':32, 'niebieski':40, 'gold':29, 'czerwony':34}),
    'L+D':     ('L+D', [], {'orange':32, 'bialy':36, 'czarny':32, 'niebieski':42, 'gold':32, 'czerwony':35}),
    'L+D+X':   ('L+D', ['X'], {'orange':33, 'bialy':39, 'czarny':35, 'niebieski':44, 'gold':35, 'czerwony':36}),
    'L+S+D':   ('L+S+D', [], {'orange':37, 'bialy':43, 'czarny':39, 'niebieski':48, 'gold':36, 'czerwony':47}),
    'L+S+D+X': ('L+S+D', ['X'], {'orange':38, 'bialy':46, 'czarny':41, 'niebieski':51, 'gold':39, 'czerwony':48}),
}

# Brief sekcja 8 — ceny roczne €
# Key = hardware|addons-key matching MONTHLY combo
YEARLY = {
    'base':    {'orange':125.92, 'bialy':142, 'czarny':132.70, 'niebieski':183, 'gold':110, 'czerwony':135},
    'D':       {'orange':169.64, 'bialy':189, 'czarny':154.30, 'niebieski':230, 'gold':145, 'czerwony':187},
    'S':       {'orange':160.31, 'bialy':160, 'czarny':135.72, 'niebieski':221, 'gold':140, 'czerwony':178},
    'S+D':     {'orange':201.79, 'bialy':178, 'czarny':166.66, 'niebieski':260, 'gold':176, 'czerwony':196},
    'L':       {'orange':178.97, 'bialy':226, 'czarny':158.27, 'niebieski':270, 'gold':177, 'czerwony':196},
    'L+S':     {'orange':210.84, 'bialy':235, 'czarny':180.03, 'niebieski':294, 'gold':197, 'czerwony':204},
    'L+D':     {'orange':219.88, 'bialy':276, 'czarny':178.86, 'niebieski':314, 'gold':211, 'czerwony':213},
    'L+S+D':   {'orange':248.30, 'bialy':275, 'czarny':209.83, 'niebieski':351, 'gold':221, 'czerwony':290},
    'L+S+D+X': {'orange':257.03, 'bialy':266, 'czarny':212.03, 'niebieski':368, 'gold':225, 'czerwony':298},
}

PLN_RATE = 4.30  # przybliżony, do uzupełnienia później przez admina

# Generate inserts
rows = []
LINES = ['gold','orange','czarny','bialy','czerwony','niebieski']  # consistent order
for combo_key, (hw, addons, prices) in MONTHLY.items():
    vcpu, ram, disk = HW[hw]
    addons_sql = "'{" + ",".join(addons) + "}'" if addons else "'{}'"
    for line in LINES:
        price_eur = prices.get(line)
        if price_eur is None:
            continue  # niedostępne dla tej linii
        transfer_tb, port_mbps, backup_from = LINE_META[line]
        ipv4 = 2 if 'X' in addons else 1
        # backup auto-included from L (in Bialy/Niebieski) OR via addon A
        bf_hw_order = ['base','S','D','S+D','L','L+S','L+D','L+S+D']
        backup_via_inclusion = backup_from is not None and bf_hw_order.index(hw) >= bf_hw_order.index(backup_from)
        backup_via_addon = 'A' in addons
        has_backup = backup_via_inclusion or backup_via_addon
        # Special Bialy: X addon zwiększa transfer 4 -> 8
        if line == 'bialy' and 'X' in addons:
            transfer_tb = 8
        # Special Niebieski: X addon podwaja port
        if line == 'niebieski' and 'X' in addons:
            port_mbps = 2000
        # Cents/grosze
        m_eur_cents = round(price_eur * 100)
        m_pln_grosze = round(price_eur * PLN_RATE * 100)
        # Yearly: NULL jeśli combo nie ma yearly
        y_data = YEARLY.get(combo_key, {}).get(line)
        if y_data is not None:
            y_eur_cents = round(y_data * 100)
            y_pln_grosze = round(y_data * PLN_RATE * 100)
            y_eur = str(y_eur_cents)
            y_pln = str(y_pln_grosze)
        else:
            y_eur = 'NULL'
            y_pln = 'NULL'
        rows.append(
            f"  ((select id from public.product_lines where sku_code='{line}'), "
            f"'{hw}', {addons_sql}, "
            f"{vcpu}, {ram}, {disk}, {transfer_tb}, {ipv4}, {port_mbps}, "
            f"{str(has_backup).lower()}, "
            f"{m_eur_cents}, {m_pln_grosze}, {y_eur}, {y_pln}, true)"
        )

print("insert into public.product_configurations (")
print("  line_id, hardware_combo, addons, vcpu, ram_gb, disk_gb, transfer_tb, ipv4_count, port_mbps,")
print("  has_backup, price_monthly_eur_cents, price_monthly_pln_grosze, price_yearly_eur_cents, price_yearly_pln_grosze, active")
print(") values")
print(",\n".join(rows))
print(";")
