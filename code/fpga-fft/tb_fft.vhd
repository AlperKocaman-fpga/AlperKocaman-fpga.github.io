-- =============================================================================
-- tb_fft.vhd
-- Non-real-time FFT with the Xilinx FFT IP (xfft_0, 4096-pt, unscaled).
--
-- Reads 32-bit binary samples from input_samples.txt ([15:0] real,
-- [31:16] imag), streams them into xfft_0 over AXI-Stream, splits each 64-bit
-- output word into real/imag, computes |X|^2 and a Newton-Raphson square root,
-- and writes:
--   fft_data_out.txt : Newton-Raphson result per bin (64-bit binary, ~|X|*2^15)
--   degerler.txt     : real^2 and imag^2 per bin, alternating lines
-- File names are relative to the xsim run directory; add input_samples.txt
-- to Vivado "Simulation Sources" so it is copied there.
-- Author: Alper Kocaman - B.Sc. graduation project, Selcuk University, 2025
-- =============================================================================
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use std.textio.ALL;
use IEEE.std_logic_textio.ALL;

entity tb_fft is
end tb_fft;

architecture Behavioral of tb_fft is
    -- Sabitler
    constant CLK_PERIOD : time := 10 ns;
    constant in_file : string := "input_samples.txt";
    constant out_file : string := "fft_data_out.txt";
    constant out_file_1 : string := "degerler.txt";
    constant DATA_IN_WIDTH : integer := 32;
    constant CONFIG_DATA_IN_WIDTH : integer := 8;


    signal clk : std_logic;
    signal aresetn : std_logic := '1';
    signal s_axis_tdata_tb : std_logic_vector(DATA_IN_WIDTH - 1 downto 0);
    signal s_axis_tvalid_tb : std_logic;
    signal s_axis_tready_tb : std_logic;
    signal s_axis_tlast_tb : std_logic;
    signal m_axis_tdata_tb : std_logic_vector(63 downto 0);
    signal m_axis_tvalid_tb : std_logic;
    signal m_axis_tlast_tb : std_logic;
    signal m_axis_tready_tb : std_logic;
    signal s_axis_config_tdata_tb : std_logic_vector(CONFIG_DATA_IN_WIDTH - 1 downto 0);
    signal s_axis_config_tvalid_tb : std_logic;
    signal s_axis_config_tready_tb : std_logic;


    file file_in : text;
    file file_out : text;
    file file_out_1 : text;


    COMPONENT xfft_0
    PORT (
        aclk : IN std_logic;
        aresetn : IN std_logic;
        s_axis_config_tdata : IN std_logic_vector(CONFIG_DATA_IN_WIDTH - 1 downto 0);
        s_axis_config_tvalid : IN std_logic;
        s_axis_config_tready : OUT std_logic;
        s_axis_data_tdata : IN std_logic_vector(DATA_IN_WIDTH - 1 downto 0);
        s_axis_data_tvalid : IN std_logic;
        s_axis_data_tready : OUT std_logic;
        s_axis_data_tlast : IN std_logic;
        m_axis_data_tdata : OUT std_logic_vector(63 downto 0);
        m_axis_data_tvalid : OUT std_logic;
        m_axis_data_tlast : OUT std_logic;
        m_axis_data_tready : IN std_logic;
        event_frame_started : OUT STD_LOGIC;
        event_tlast_unexpected : OUT STD_LOGIC;
        event_tlast_missing : OUT STD_LOGIC;
        event_status_channel_halt : OUT STD_LOGIC;
        event_data_in_channel_halt : OUT STD_LOGIC;
        event_data_out_channel_halt : OUT STD_LOGIC
    );
    END COMPONENT;


    signal sqrt_approx_out : std_logic_vector(63 downto 0);
    signal magnitude_out : signed(63 downto 0);
    signal reel_squared_out : signed(63 downto 0);
    signal imag_squared_out : signed(63 downto 0);


    function newton_raphson_sqrt(input: signed) return signed is
        variable x_n: signed(63 downto 0);
        variable x_next: signed(63 downto 0);
        variable temp: signed(127 downto 0);
        constant SCALE_FACTOR: integer := 30;
        constant ITERATIONS: integer := 8;
    begin
        -- Daha iyi bir başlangıç tahmini
        x_n := resize(shift_right(input + to_signed(1, input'length), 2), 64);

        -- İyileştirilmiş Newton-Raphson iterasyonları
        for i in 1 to ITERATIONS loop
            if x_n /= 0 then
                -- Yüksek hassasiyetli bölme işlemi
                temp := resize(input * to_signed(2**SCALE_FACTOR, 64), 128);
                temp := temp / resize(x_n, 128);

                -- Sonraki tahmin hesaplama
                x_next := resize(x_n + resize(temp, 64), 64);
                x_n := shift_right(x_next, 1);
            end if;
        end loop;

        return x_n;
    end function;

begin
    -- Saat sinyali üreteci
    clk_gen : process
    begin
        clk <= '1';
        wait for CLK_PERIOD / 2;
        clk <= '0';
        wait for CLK_PERIOD / 2;
    end process clk_gen;

    -- Giriş dosyasından okuma process'i
    read_file : process
        variable v_in_line : line;
        variable data : std_logic_vector(DATA_IN_WIDTH - 1 downto 0);
    begin
        file_open(file_in, in_file, read_mode);
        s_axis_tvalid_tb <= '0';
        s_axis_tdata_tb <= (others => '0');

        loop_all : while true loop
            wait until (s_axis_tready_tb = '1');

            loop_file : while s_axis_tready_tb = '1' and not endfile(file_in) loop
                s_axis_tvalid_tb <= '1';
                readline(file_in, v_in_line);
                read(v_in_line, data);
                s_axis_tdata_tb <= data;
                wait until (clk'event and clk = '1');
            end loop;

            s_axis_tvalid_tb <= '0';
            s_axis_tlast_tb <= '1';
        end loop;

        s_axis_tdata_tb <= (others => '0');
        s_axis_tvalid_tb <= '0';
        file_close(file_in);
        wait;
    end process read_file;

    -- Çıkış dosyasına yazma process'i
    write_file : process
        variable v_out_line : line;
        variable satir : line;
        variable data_out : std_logic_vector(63 downto 0);
        variable reel : std_logic_vector(31 downto 0);
        variable imag : std_logic_vector(31 downto 0);
        variable reel_squared : signed(63 downto 0);
        variable imag_squared : signed(63 downto 0);
        variable magnitude : signed(63 downto 0);
        variable sqrt_result : signed(63 downto 0);
    begin
        m_axis_tready_tb <= '1';
        file_open(file_out, out_file, write_mode);
        file_open(file_out_1, out_file_1, write_mode);

        loop_all : while true loop
            wait until (m_axis_tvalid_tb = '1');

            loop_file : while m_axis_tvalid_tb = '1' loop
                data_out := m_axis_tdata_tb;
                reel := m_axis_tdata_tb(31 downto 0);
                imag := m_axis_tdata_tb(63 downto 32);

                -- Kareler hesaplama (64-bit hassasiyet)
                reel_squared := resize(signed(reel) * signed(reel), 64);
                imag_squared := resize(signed(imag) * signed(imag), 64);

                -- Magnitude hesaplama
                magnitude := reel_squared + imag_squared;
                magnitude_out <= magnitude;

                -- Karekök hesaplama (64-bit)
                sqrt_result := newton_raphson_sqrt(magnitude);

                -- Sonuçları dosyaya yazma
                sqrt_approx_out <= std_logic_vector(sqrt_result);
                write(v_out_line, sqrt_approx_out);
                writeline(file_out, v_out_line);

                -- Ara değerleri dosyaya yazma
                write(satir, std_logic_vector(reel_squared));
                writeline(file_out_1, satir);
                write(satir, std_logic_vector(imag_squared));
                writeline(file_out_1, satir);

                wait until (clk'event and clk = '1');
            end loop;
        end loop;

        m_axis_tready_tb <= '0';
        file_close(file_out);
        file_close(file_out_1);
        wait;
    end process write_file;

    -- FFT konfigürasyon process'i
    config : process
    begin
        s_axis_config_tdata_tb <= "00000001";  -- FFT konfigürasyonu
        s_axis_config_tvalid_tb <= '0';
        wait for 20 ns;
        s_axis_config_tvalid_tb <= '1';
        wait for 20 ns;
        s_axis_config_tvalid_tb <= '0';
        wait;
    end process;

    -- FFT bileşeni port eşleştirmesi
    fft_inst : xfft_0
    PORT MAP (
        aclk => clk,
        aresetn => aresetn,
        s_axis_config_tdata => s_axis_config_tdata_tb,
        s_axis_config_tvalid => s_axis_config_tvalid_tb,
        s_axis_config_tready => s_axis_config_tready_tb,
        s_axis_data_tdata => s_axis_tdata_tb,
        s_axis_data_tvalid => s_axis_tvalid_tb,
        s_axis_data_tready => s_axis_tready_tb,
        s_axis_data_tlast => s_axis_tlast_tb,
        m_axis_data_tdata => m_axis_tdata_tb,
        m_axis_data_tvalid => m_axis_tvalid_tb,
        m_axis_data_tlast => m_axis_tlast_tb,
        m_axis_data_tready => m_axis_tready_tb,
        event_frame_started => open,
        event_tlast_unexpected => open,
        event_tlast_missing => open,
        event_status_channel_halt => open,
        event_data_in_channel_halt => open,
        event_data_out_channel_halt => open
    );

end Behavioral;
