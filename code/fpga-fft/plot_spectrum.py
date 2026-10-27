"""Plot the spectrum produced by tb_fft.vhd and check the Newton-Raphson result.

Reads the two files written by the testbench:
    degerler.txt     real^2 and imag^2 per bin (alternating 64-bit binary lines)
    fft_data_out.txt Newton-Raphson square-root output per bin (64-bit binary)

The exact magnitude is sqrt(real^2 + imag^2). The Newton-Raphson function
returns approximately sqrt(|X|^2 * 2^30) = |X| * 2^15, so it is divided by
2^15 before the comparison.

Example:
    python plot_spectrum.py --sim-dir <project>.sim/sim_1/behav/xsim
"""
import argparse
import os

import numpy as np
import matplotlib.pyplot as plt


def read_signed(path):
    vals = []
    with open(path) as fh:
        for line in fh:
            s = line.strip()
            if not s:
                continue
            v = int(s, 2)
            if s[0] == "1":
                v -= 1 << len(s)
            vals.append(v)
    return np.array(vals, dtype=object)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sim-dir", default=".", help="directory containing the testbench output files")
    p.add_argument("--fs", type=float, default=250e6, help="sample rate in Hz")
    p.add_argument("--n", type=int, default=4096, help="FFT length")
    p.add_argument("--fmax", type=float, default=None, help="upper frequency limit of the plot in Hz")
    p.add_argument("-o", "--output", default="spectrum.png")
    args = p.parse_args()

    sq = read_signed(os.path.join(args.sim_dir, "degerler.txt"))
    nr = read_signed(os.path.join(args.sim_dir, "fft_data_out.txt"))
    n = min(len(sq) // 2, len(nr), args.n)
    re2, im2 = sq[0:2 * n:2], sq[1:2 * n:2]
    exact = np.array([float(np.sqrt(float(a + b))) for a, b in zip(re2, im2)])
    approx = np.array([float(v) for v in nr[:n]]) / 2**15

    f = np.arange(n) * args.fs / args.n
    half = n // 2
    k = int(np.argmax(exact[1:half])) + 1
    print(f"strongest bin (excluding DC): {k} -> {f[k] / 1e6:.3f} MHz")

    mask = exact > 0.01 * exact[1:half].max()
    rel = np.abs(approx[mask] - exact[mask]) / exact[mask]
    print(f"Newton-Raphson vs exact magnitude on significant bins: "
          f"median error {np.median(rel) * 100:.2f} %, max error {rel.max() * 100:.1f} %")

    fig, ax = plt.subplots(figsize=(9, 4), dpi=130)
    ax.plot(f[:half] / 1e6, exact[:half], lw=1.5, label="exact |X| from real² + imag²")
    ax.plot(f[:half] / 1e6, approx[:half], lw=1, ls="--", label="Newton-Raphson output / 2¹⁵")
    ax.set_xlabel("Frequency (MHz)")
    ax.set_ylabel("|X|")
    ax.set_title("FFT magnitude from Vivado simulation", loc="left")
    if args.fmax:
        ax.set_xlim(0, args.fmax / 1e6)
    ax.grid(alpha=0.3)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(args.output)
    print(f"saved {args.output}")


if __name__ == "__main__":
    main()
