#ifndef CONFIGPARSER_H
#define CONFIGPARSER_H
#pragma once

#include <exception>
#include <fstream>
#include <iostream>
#include <sstream>

// clang-format off
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>
// clang-format on

#include "../generator/DictGenerator.hpp"
#include "../generator/Generator.hpp"
#include "../generator/Rule.hpp"
#include "../generator/RuleGenerator.hpp"
#include "Config.hpp"

class ConfigParser {
private:
  static string _read_val(const ryml::NodeRef &node);
  static string _read_val(const ryml::NodeRef &node, const string &key);
  static bool _str2bool(const string &str);
  static string _csubstr2str(const c4::csubstr &str);
  static string _get_file_contents(const string &filename);

public:
  static Config parse_config(const string &content);
  static Config parse_config_from_path(const string &filename);
  static vector<shared_ptr<Generator>>
  parse_generator(const ryml::NodeRef &node);
  static shared_ptr<Rule> parse_rule(const ryml::NodeRef &node);
};
#endif