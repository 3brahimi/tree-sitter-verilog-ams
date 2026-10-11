from unittest import TestCase

from tree_sitter import Language, Parser
import tree_sitter_verilog_ams

SAMPLE = b"""
module res(p, n);
  inout p, n;
  electrical p, n;
  parameter real r = 1k from (0:inf);
  analog begin
    I(p, n) <+ V(p, n) / r + ddt(1p * V(p, n));
    @(cross(V(p, n) - 0.5, +1)) $strobe("t=%g", $abstime);
  end
endmodule
"""


def node_types(node):
    stack = [node]
    while stack:
        current = stack.pop()
        yield current.type
        stack.extend(current.children)


class TestLanguage(TestCase):
    def test_can_load_grammar(self):
        try:
            Parser(Language(tree_sitter_verilog_ams.language()))
        except Exception:
            self.fail("Error loading Verilog-AMS grammar")

    def test_parses_sample(self):
        parser = Parser(Language(tree_sitter_verilog_ams.language()))
        root = parser.parse(SAMPLE).root_node
        self.assertFalse(root.has_error)
        types = set(node_types(root))
        for expected in ("analog_construct", "contribution_statement", "branch_probe",
                         "analog_operator_call", "analog_event_function",
                         "scaled_real_number", "parameter_value_range"):
            self.assertIn(expected, types)
